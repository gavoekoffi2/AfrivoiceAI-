import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, organizations } from "@/lib/db/schema";
import { verifyShopifyWebhook, isCashOnDelivery } from "@/lib/shopify/verify";
import { normalizePhoneNumber } from "@/lib/utils";
import { triggerInternalCall } from "@/lib/internal/jobs";

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

    const payload: ShopifyOrderPayload = JSON.parse(rawBody);
    const topic = req.headers.get("x-shopify-topic");

    // Ne traiter que les créations de commande
    if (topic !== "orders/create") {
      return NextResponse.json({ received: true });
    }

    // Vérifier si c'est une commande COD
    if (!isCashOnDelivery(payload.gateway)) {
      console.log(
        `[shopify/webhook] Commande ${payload.id} ignorée (gateway: ${payload.gateway})`
      );
      return NextResponse.json({ received: true, action: "ignored_non_cod" });
    }

    // Router la commande vers la BONNE organisation via le domaine Shopify.
    // Isolation multi-tenant : une commande n'est acceptée que si son domaine
    // est explicitement rattaché à une organisation.
    if (!shopDomain) {
      console.warn("[shopify/webhook] En-tête x-shopify-shop-domain manquant");
      return NextResponse.json(
        { error: "Domaine boutique manquant" },
        { status: 400 }
      );
    }

    const orgResult = await db
      .select()
      .from(organizations)
      .where(eq(organizations.shopDomain, shopDomain))
      .limit(1);
    const organization = orgResult[0];

    if (!organization) {
      console.error(
        `[shopify/webhook] Aucune organisation rattachée au domaine ${shopDomain}`
      );
      return NextResponse.json(
        { error: "Domaine boutique non rattaché à une organisation" },
        { status: 404 }
      );
    }

    // Extraire les données du client
    const customerName = [
      payload.customer?.first_name,
      payload.customer?.last_name,
    ]
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
        externalId: payload.id.toString(),
        source: "shopify",
        customerName,
        customerPhone: normalizedPhone,
        customerAddress: customerAddress || null,
        totalAmount: payload.total_price,
        currency: payload.currency || "XOF",
        status: "pending",
        rawPayload: payload as unknown as Record<string, unknown>,
      })
      .returning();

    console.log(
      `[shopify/webhook] Commande COD créée: ${insertedOrder[0].id} pour ${customerName}`
    );

    // Déclencher l'appel de confirmation via un token interne DÉDIÉ
    // (jamais la clé service_role, qui donne un accès total à la base).
    await triggerInternalCall({ orderId: insertedOrder[0].id }).catch((err) => {
      console.error(
        `[shopify/webhook] Erreur déclenchement appel pour commande ${insertedOrder[0].id}:`,
        err
      );
    });

    return NextResponse.json({
      received: true,
      orderId: insertedOrder[0].id,
      action: "call_initiated",
    });
  } catch (error) {
    console.error("[shopify/webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
