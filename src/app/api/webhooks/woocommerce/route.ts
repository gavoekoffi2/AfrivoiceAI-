import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { normalizePhoneNumber } from "@/lib/utils";
import { startEcommerceConfirmationCall } from "@/lib/calls/initiate-ecommerce";
import { findOrganizationByStoreDomain } from "@/lib/store-domain";

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
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[woocommerce] WOOCOMMERCE_WEBHOOK_SECRET manquant : webhook rejeté en production"
      );
      return false;
    }
    return true; // Pas de secret configuré, accepter en dev
  }

  if (!signature) return false;

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    const expected = Buffer.from(computedHash);
    const received = Buffer.from(signature);
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
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

    // Retrouver l'organisation via le domaine de la boutique WooCommerce
    // (header x-wc-webhook-source envoyé par WooCommerce).
    const webhookSource = req.headers.get("x-wc-webhook-source");
    const organization = await findOrganizationByStoreDomain(webhookSource);

    if (!organization) {
      console.error(
        `[woocommerce/webhook] Aucune organisation pour la source: ${webhookSource}`
      );
      return NextResponse.json(
        { error: "Boutique non reconnue. Configurez le domaine dans les paramètres AfrivoxAI." },
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

    // Déclencher l'appel de confirmation directement (pas d'appel HTTP interne)
    startEcommerceConfirmationCall(insertedOrder[0], organization.id).catch(
      (err) => {
        console.error(`[woocommerce/webhook] Erreur déclenchement appel:`, err);
      }
    );

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
