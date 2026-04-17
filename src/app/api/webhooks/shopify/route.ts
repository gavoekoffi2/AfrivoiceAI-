import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyShopifyWebhook, isCashOnDelivery } from "@/lib/shopify/verify";
import { resolveOrganizationByShopifyDomain } from "@/lib/shopify/resolve-org";
import { normalizePhoneNumber } from "@/lib/utils";
import { markWebhookProcessed } from "@/lib/idempotency";
import { internalHeader } from "@/lib/internal-auth";
import { logger } from "@/lib/logger";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

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
    const ip = ipFromRequest(req);
    const rl = rateLimit(`webhook:shopify:${ip}`, 120, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Trop de requêtes" },
        { status: 429 }
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-shopify-hmac-sha256");
    const shopDomain = req.headers.get("x-shopify-shop-domain");
    const topic = req.headers.get("x-shopify-topic");

    if (!verifyShopifyWebhook(rawBody, signature)) {
      logger.warn("shopify/webhook", "Signature HMAC invalide", {
        shopDomain,
      });
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    if (topic !== "orders/create") {
      return NextResponse.json({ received: true });
    }

    const payload: ShopifyOrderPayload = JSON.parse(rawBody);

    if (!isCashOnDelivery(payload.gateway)) {
      logger.info("shopify/webhook", "Commande non COD ignorée", {
        orderId: payload.id,
        gateway: payload.gateway,
      });
      return NextResponse.json({ received: true, action: "ignored_non_cod" });
    }

    const organization = await resolveOrganizationByShopifyDomain(shopDomain);
    if (!organization) {
      logger.error(
        "shopify/webhook",
        "Aucune organisation mappée sur ce domaine",
        { shopDomain }
      );
      return NextResponse.json(
        {
          error:
            "Aucune organisation associée à ce domaine. Configurez-le dans Paramètres → Intégrations.",
        },
        { status: 404 }
      );
    }

    const rawPhone =
      payload.shipping_address?.phone ||
      payload.customer?.phone ||
      payload.billing_address?.phone;

    if (!rawPhone) {
      return NextResponse.json(
        { error: "Numéro de téléphone manquant" },
        { status: 422 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(
      rawPhone,
      organization.countryCode || "TG"
    );
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Numéro de téléphone invalide" },
        { status: 422 }
      );
    }

    // Idempotency : rejeter si déjà traité
    const isNew = await markWebhookProcessed({
      provider: "shopify",
      externalId: `order_${payload.id}`,
      organizationId: organization.id,
      payload,
    });
    if (!isNew) {
      return NextResponse.json({
        received: true,
        action: "duplicate_ignored",
      });
    }

    // Upsert : si la commande existe déjà (retry), on la récupère.
    const existing = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organization.id),
          eq(orders.source, "shopify"),
          eq(orders.externalId, payload.id.toString())
        )
      )
      .limit(1);

    if (existing[0]) {
      return NextResponse.json({
        received: true,
        action: "already_exists",
        orderId: existing[0].id,
      });
    }

    const customerName =
      [payload.customer?.first_name, payload.customer?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "Client";

    const customerAddress = [
      payload.shipping_address?.address1,
      payload.shipping_address?.city,
      payload.shipping_address?.country,
    ]
      .filter(Boolean)
      .join(", ");

    const [insertedOrder] = await db
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

    await db.insert(notifications).values({
      organizationId: organization.id,
      type: "order_received",
      title: "Nouvelle commande Shopify",
      body: `${customerName} — ${payload.total_price} ${payload.currency}`,
      link: `/dashboard/e-commerce`,
    });

    logger.info("shopify/webhook", "Commande COD créée", {
      orderId: insertedOrder.id,
      organizationId: organization.id,
    });

    // Déclencher l'appel de confirmation (non bloquant)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    fetch(`${baseUrl}/api/calls/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalHeader() },
      body: JSON.stringify({ orderId: insertedOrder.id }),
    }).catch((err) => {
      logger.error("shopify/webhook", "Erreur déclenchement appel", {
        orderId: insertedOrder.id,
        err: String(err),
      });
    });

    return NextResponse.json({
      received: true,
      orderId: insertedOrder.id,
      action: "call_initiated",
    });
  } catch (error) {
    logger.error("shopify/webhook", "Erreur serveur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
