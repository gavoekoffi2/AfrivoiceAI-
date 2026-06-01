import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { verifyShopifyWebhook, isCashOnDelivery } from "@/lib/shopify/verify";
import { normalizePhoneNumber } from "@/lib/utils";
import { resolveOrganizationForShop } from "@/lib/ecommerce/resolve-org";
import { initiateEcommerceCall } from "@/lib/calls/initiate";

interface ShopifyOrderPayload {
  id: number;
  total_price: string;
  currency: string;
  gateway: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  shipping_address?: {
    address1?: string;
    city?: string;
    country?: string;
    phone?: string;
  };
  billing_address?: {
    phone?: string;
  };
  note?: string;
}

export async function POST(req: Request) {
  try {
    // Lire le body brut pour la vérification HMAC
    const rawBody = await req.text();
    const signature = req.headers.get("x-shopify-hmac-sha256");
    const shopDomain = req.headers.get("x-shopify-shop-domain");

    // Vérifier la signature Shopify
    if (!verifyShopifyWebhook(rawBody, signature)) {
      console.warn("[shopify/webhook] Signature HMAC invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    const topic = req.headers.get("x-shopify-topic");

    // Ne traiter que les créations de commande
    if (topic !== "orders/create") {
      return NextResponse.json({ received: true });
    }

    let payload: ShopifyOrderPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    // Vérifier si c'est une commande COD
    if (!isCashOnDelivery(payload.gateway ?? "")) {
      console.log(
        `[shopify/webhook] Commande ${payload.id} ignorée (gateway: ${payload.gateway})`
      );
      return NextResponse.json({ received: true, action: "ignored_non_cod" });
    }

    // Router la commande vers la bonne organisation
    const organizationId = await resolveOrganizationForShop(shopDomain);
    if (!organizationId) {
      console.error(
        `[shopify/webhook] Organisation introuvable pour le domaine: ${shopDomain ?? "inconnu"}`
      );
      return NextResponse.json(
        { error: "Organisation introuvable" },
        { status: 404 }
      );
    }

    // Extraire les données du client
    const customerName =
      [payload.customer?.first_name, payload.customer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "Client";

    const rawPhone =
      payload.shipping_address?.phone ||
      payload.customer?.phone ||
      payload.billing_address?.phone;

    if (!rawPhone) {
      console.warn(
        `[shopify/webhook] Commande ${payload.id} : numéro de téléphone manquant`
      );
      return NextResponse.json(
        { error: "Numéro de téléphone manquant" },
        { status: 422 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone, "TG");
    if (!normalizedPhone) {
      console.warn(
        `[shopify/webhook] Numéro invalide pour la commande ${payload.id}: ${rawPhone}`
      );
      return NextResponse.json(
        { error: "Numéro de téléphone invalide" },
        { status: 422 }
      );
    }

    const customerAddress = [
      payload.shipping_address?.address1,
      payload.shipping_address?.city,
      payload.shipping_address?.country,
    ]
      .filter(Boolean)
      .join(", ");

    // Insertion idempotente : si Shopify renvoie le même webhook (retries),
    // la contrainte unique (org, source, externalId) empêche les doublons
    // et donc le double-appel facturé.
    const insertedOrder = await db
      .insert(orders)
      .values({
        organizationId,
        externalId: payload.id.toString(),
        source: "shopify",
        customerName,
        customerPhone: normalizedPhone,
        customerAddress: customerAddress || null,
        totalAmount: payload.total_price,
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
        `[shopify/webhook] Commande ${payload.id} déjà traitée (doublon ignoré)`
      );
      return NextResponse.json({ received: true, action: "duplicate_ignored" });
    }

    const order = insertedOrder[0];
    console.log(
      `[shopify/webhook] Commande COD créée: ${order.id} pour ${customerName}`
    );

    // Déclencher l'appel directement (in-process), sans round-trip HTTP ni
    // partage de la clé service-role. On ATTEND la fin : en serverless le
    // travail post-réponse est tué. L'idempotence (index unique) garantit
    // l'absence de double appel si Shopify renvoie le webhook (retry).
    const callResult = await initiateEcommerceCall(order, organizationId);
    if (!callResult.ok) {
      console.error(
        `[shopify/webhook] Initiation appel échouée pour commande ${order.id}: ${callResult.code}`
      );
    }

    return NextResponse.json({
      received: true,
      orderId: order.id,
      action: callResult.ok ? "call_initiated" : "call_failed",
    });
  } catch (error) {
    console.error("[shopify/webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
