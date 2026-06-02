import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { resolveWebhookOrganization } from "@/lib/webhooks/tenant";
import { triggerConfirmationCall } from "@/lib/webhooks/trigger-call";
import { normalizePhoneNumber } from "@/lib/utils";

interface WooCommerceOrderPayload {
  id: number;
  status: string;
  total: string;
  currency: string;
  payment_method: string;
  payment_method_title: string;
  billing: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address_1?: string;
    city?: string;
    country?: string;
  };
  shipping: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address_1?: string;
    city?: string;
    country?: string;
  };
  meta_data?: Array<{ key: string; value: string }>;
}

function verifyWooCommerceWebhook(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  if (!secret) {
    // Fail-closed en production : sans secret, on REJETTE (sinon n'importe qui
    // pourrait forger des commandes). En dev on tolère pour faciliter les tests.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[woocommerce] WOOCOMMERCE_WEBHOOK_SECRET non configuré : webhook rejeté"
      );
      return false;
    }
    console.warn(
      "[woocommerce] WOOCOMMERCE_WEBHOOK_SECRET absent (toléré hors production)"
    );
    return true;
  }

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const computedBuf = Buffer.from(computedHash);
  const signatureBuf = Buffer.from(signature);
  if (computedBuf.length !== signatureBuf.length) return false;

  try {
    return crypto.timingSafeEqual(computedBuf, signatureBuf);
  } catch {
    return false;
  }
}

function isWooCommerceCOD(paymentMethod: string | undefined | null): boolean {
  if (!paymentMethod) return false;
  const value = paymentMethod.toLowerCase();
  const codMethods = ["cod", "cash_on_delivery", "paiement_livraison"];
  return codMethods.some((m) => value.includes(m));
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-wc-webhook-signature");
    const topic = req.headers.get("x-wc-webhook-topic");
    const sourceDomain = req.headers.get("x-wc-webhook-source");

    if (!verifyWooCommerceWebhook(rawBody, signature)) {
      console.warn("[woocommerce/webhook] Signature invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    // Ne traiter que les créations de commande
    if (topic !== "order.created") {
      return NextResponse.json({ received: true });
    }

    const payload: WooCommerceOrderPayload = JSON.parse(rawBody);

    // Vérifier si c'est une commande COD
    if (!isWooCommerceCOD(payload.payment_method)) {
      return NextResponse.json({
        received: true,
        action: "ignored_non_cod",
        payment_method: payload.payment_method,
      });
    }

    // Router la commande vers la bonne organisation via le domaine du site.
    const organization = await resolveWebhookOrganization(
      "woocommerce",
      sourceDomain
    );

    if (!organization) {
      console.error(
        `[woocommerce/webhook] Aucune organisation pour la source: ${sourceDomain ?? "inconnue"}`
      );
      return NextResponse.json(
        { error: "Organisation introuvable pour ce site" },
        { status: 404 }
      );
    }

    // Extraire les données client (billing > shipping)
    const firstName =
      payload.shipping?.first_name ||
      payload.billing?.first_name ||
      "";
    const lastName =
      payload.shipping?.last_name || payload.billing?.last_name || "";
    const customerName = `${firstName} ${lastName}`.trim() || "Client";

    const rawPhone =
      payload.billing?.phone || payload.shipping?.phone || "";

    if (!rawPhone) {
      return NextResponse.json(
        { error: "Numéro de téléphone manquant" },
        { status: 422 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone, "TG");
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Numéro de téléphone invalide" },
        { status: 422 }
      );
    }

    const address = [
      payload.shipping?.address_1 || payload.billing?.address_1,
      payload.shipping?.city || payload.billing?.city,
      payload.shipping?.country || payload.billing?.country,
    ]
      .filter(Boolean)
      .join(", ");

    const insertedOrder = await db
      .insert(orders)
      .values({
        organizationId: organization.id,
        externalId: payload.id.toString(),
        source: "woocommerce",
        customerName,
        customerPhone: normalizedPhone,
        customerAddress: address || null,
        totalAmount: payload.total,
        currency: payload.currency || "XOF",
        status: "pending",
        rawPayload: payload as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing({
        target: [orders.organizationId, orders.source, orders.externalId],
      })
      .returning();

    // Commande déjà traitée précédemment → on acquitte sans relancer d'appel.
    if (!insertedOrder[0]) {
      console.log(
        `[woocommerce/webhook] Commande ${payload.id} déjà existante, ignorée (idempotence)`
      );
      return NextResponse.json({ received: true, action: "duplicate_ignored" });
    }

    console.log(
      `[woocommerce/webhook] Commande COD créée: ${insertedOrder[0].id} pour ${customerName}`
    );

    // Déclencher l'appel de confirmation
    triggerConfirmationCall(insertedOrder[0].id);

    return NextResponse.json({
      received: true,
      orderId: insertedOrder[0].id,
      action: "call_initiated",
    });
  } catch (error) {
    console.error("[woocommerce/webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
