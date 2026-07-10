import { NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, organizations } from "@/lib/db/schema";
import { normalizePhoneNumber } from "@/lib/utils";
import { triggerInternalCall } from "@/lib/internal/jobs";

/** Extrait le hostname d'une URL de source WooCommerce (`x-wc-webhook-source`). */
function extractDomain(source: string | null): string | null {
  if (!source) return null;
  try {
    return new URL(source).hostname.toLowerCase();
  } catch {
    return source.trim().toLowerCase() || null;
  }
}

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
    // Fail-closed : sans secret configuré, on refuse (pas d'acceptation en dev).
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
    const sourceDomain = extractDomain(req.headers.get("x-wc-webhook-source"));

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

    // Router vers la BONNE organisation via le domaine source WooCommerce.
    if (!sourceDomain) {
      console.warn("[woocommerce/webhook] En-tête x-wc-webhook-source manquant");
      return NextResponse.json(
        { error: "Domaine source manquant" },
        { status: 400 }
      );
    }

    const orgResult = await db
      .select()
      .from(organizations)
      .where(eq(organizations.shopDomain, sourceDomain))
      .limit(1);
    const organization = orgResult[0];

    if (!organization) {
      console.error(
        `[woocommerce/webhook] Aucune organisation rattachée au domaine ${sourceDomain}`
      );
      return NextResponse.json(
        { error: "Domaine non rattaché à une organisation" },
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
      .returning();

    console.log(
      `[woocommerce/webhook] Commande COD créée: ${insertedOrder[0].id} pour ${customerName}`
    );

    // Déclencher l'appel de confirmation via un token interne DÉDIÉ.
    await triggerInternalCall({ orderId: insertedOrder[0].id }).catch((err) => {
      console.error(`[woocommerce/webhook] Erreur déclenchement appel:`, err);
    });

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
