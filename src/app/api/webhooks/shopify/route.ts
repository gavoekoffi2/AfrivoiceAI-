import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyShopifyWebhook, isCashOnDelivery } from "@/lib/shopify/verify";
import { normalizePhoneNumber } from "@/lib/utils";
import { resolveWebhookOrganization } from "@/lib/webhooks";
import { initiateOrderCall } from "@/lib/calls/initiate";

interface ShopifyOrderPayload {
  id?: number;
  total_price?: string;
  currency?: string;
  gateway?: string;
  payment_gateway_names?: string[];
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
      return NextResponse.json({ received: true, action: "ignored_non_json" });
    }

    if (payload.id === undefined || payload.id === null) {
      return NextResponse.json({ received: true, action: "ignored_no_id" });
    }

    // Vérifier si c'est une commande COD (gateway est déprécié chez Shopify,
    // payment_gateway_names le remplace — on regarde les deux)
    const gateways = [
      payload.gateway,
      ...(payload.payment_gateway_names ?? []),
    ].filter((g): g is string => Boolean(g));

    if (!gateways.some((g) => isCashOnDelivery(g))) {
      console.log(
        `[shopify/webhook] Commande ${payload.id} ignorée (gateways: ${gateways.join(", ") || "aucun"})`
      );
      return NextResponse.json({ received: true, action: "ignored_non_cod" });
    }

    // Identifier l'organisation destinataire (?org=<id> dans l'URL du webhook)
    const organization = await resolveWebhookOrganization(req.url);
    if (!organization) {
      console.error("[shopify/webhook] Organisation introuvable");
      return NextResponse.json(
        { error: "Organisation introuvable — vérifiez le paramètre ?org= de l'URL du webhook" },
        { status: 404 }
      );
    }

    const externalId = payload.id.toString();

    // Idempotence : Shopify relivre les webhooks en cas de timeout
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organization.id),
          eq(orders.source, "shopify"),
          eq(orders.externalId, externalId)
        )
      )
      .limit(1);

    if (existing[0]) {
      return NextResponse.json({
        received: true,
        orderId: existing[0].id,
        action: "duplicate_ignored",
      });
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

    // Insérer la commande
    const insertedOrder = await db
      .insert(orders)
      .values({
        organizationId: organization.id,
        externalId,
        source: "shopify",
        customerName,
        customerPhone: normalizedPhone,
        customerAddress: customerAddress || null,
        totalAmount: payload.total_price ?? null,
        currency: payload.currency || "XOF",
        status: "pending",
        rawPayload: payload as unknown as Record<string, unknown>,
      })
      .returning();

    console.log(
      `[shopify/webhook] Commande COD créée: ${insertedOrder[0].id} pour ${customerName}`
    );

    // Déclencher l'appel de confirmation (appel direct, sans HTTP interne).
    // En cas d'échec (solde insuffisant, Vapi indisponible), la commande
    // reste "pending" et peut être relancée manuellement depuis le dashboard.
    const callResult = await initiateOrderCall(insertedOrder[0]).catch(
      (err) => {
        console.error(
          `[shopify/webhook] Erreur déclenchement appel pour commande ${insertedOrder[0].id}:`,
          err
        );
        return null;
      }
    );

    return NextResponse.json({
      received: true,
      orderId: insertedOrder[0].id,
      action: callResult?.ok ? "call_initiated" : "order_created",
    });
  } catch (error) {
    console.error("[shopify/webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
