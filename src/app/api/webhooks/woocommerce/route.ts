import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { normalizePhoneNumber } from "@/lib/utils";
import { resolveOrganizationForShop } from "@/lib/ecommerce/resolve-org";
import { initiateEcommerceCall } from "@/lib/calls/initiate";

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
    // Fail-closed en production ; tolérance uniquement hors production pour
    // faciliter les tests locaux.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[woocommerce] WOOCOMMERCE_WEBHOOK_SECRET absent — accepté en mode dev uniquement"
      );
      return true;
    }
    console.error("[woocommerce] WOOCOMMERCE_WEBHOOK_SECRET non configuré");
    return false;
  }

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

function isWooCommerceCOD(paymentMethod: string): boolean {
  const codMethods = ["cod", "cash_on_delivery", "paiement_livraison"];
  return codMethods.some((m) =>
    paymentMethod.toLowerCase().includes(m.toLowerCase())
  );
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-wc-webhook-signature");
    const topic = req.headers.get("x-wc-webhook-topic");
    const source = req.headers.get("x-wc-webhook-source");

    if (!verifyWooCommerceWebhook(rawBody, signature)) {
      console.warn("[woocommerce/webhook] Signature invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    // Ne traiter que les créations de commande
    if (topic !== "order.created") {
      return NextResponse.json({ received: true });
    }

    let payload: WooCommerceOrderPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    // Vérifier si c'est une commande COD
    if (!isWooCommerceCOD(payload.payment_method ?? "")) {
      return NextResponse.json({
        received: true,
        action: "ignored_non_cod",
        payment_method: payload.payment_method,
      });
    }

    const organizationId = await resolveOrganizationForShop(source);
    if (!organizationId) {
      console.error(
        `[woocommerce/webhook] Organisation introuvable pour la source: ${source ?? "inconnue"}`
      );
      return NextResponse.json(
        { error: "Organisation introuvable" },
        { status: 404 }
      );
    }

    // Extraire les données client (billing > shipping)
    const firstName =
      payload.shipping?.first_name || payload.billing?.first_name || "";
    const lastName =
      payload.shipping?.last_name || payload.billing?.last_name || "";
    const customerName = `${firstName} ${lastName}`.trim() || "Client";

    const rawPhone = payload.billing?.phone || payload.shipping?.phone || "";

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
        organizationId,
        externalId: payload.id.toString(),
        source: "woocommerce",
        customerName,
        customerPhone: normalizedPhone,
        customerAddress: address || null,
        totalAmount: payload.total,
        currency: payload.currency || "XOF",
        status: "pending",
        rawPayload: payload,
      })
      .onConflictDoNothing({
        target: [orders.organizationId, orders.source, orders.externalId],
      })
      .returning();

    if (!insertedOrder[0]) {
      console.log(
        `[woocommerce/webhook] Commande ${payload.id} déjà traitée (doublon ignoré)`
      );
      return NextResponse.json({ received: true, action: "duplicate_ignored" });
    }

    const order = insertedOrder[0];
    console.log(
      `[woocommerce/webhook] Commande COD créée: ${order.id} pour ${customerName}`
    );

    // On attend la fin (serverless : pas de travail post-réponse).
    // Idempotence (index unique) => pas de double appel sur retry WooCommerce.
    const callResult = await initiateEcommerceCall(order, organizationId);
    if (!callResult.ok) {
      console.error(
        `[woocommerce/webhook] Initiation appel échouée pour commande ${order.id}: ${callResult.code}`
      );
    }

    return NextResponse.json({
      received: true,
      orderId: order.id,
      action: callResult.ok ? "call_initiated" : "call_failed",
    });
  } catch (error) {
    console.error("[woocommerce/webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
