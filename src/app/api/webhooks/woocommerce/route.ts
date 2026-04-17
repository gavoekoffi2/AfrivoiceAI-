import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { orders, notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { normalizePhoneNumber } from "@/lib/utils";
import { resolveOrganizationByWoocommerceDomain } from "@/lib/shopify/resolve-org";
import { markWebhookProcessed } from "@/lib/idempotency";
import { internalHeader } from "@/lib/internal-auth";
import { logger } from "@/lib/logger";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

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
    logger.warn("woocommerce/webhook", "Secret non configuré");
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
  const codMethods = [
    "cod",
    "cash_on_delivery",
    "paiement_livraison",
    "cash-on-delivery",
  ];
  return codMethods.some((m) =>
    paymentMethod.toLowerCase().includes(m.toLowerCase())
  );
}

export async function POST(req: Request) {
  try {
    const ip = ipFromRequest(req);
    const rl = rateLimit(`webhook:woo:${ip}`, 120, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Trop de requêtes" },
        { status: 429 }
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-wc-webhook-signature");
    const topic = req.headers.get("x-wc-webhook-topic");
    const sourceUrl = req.headers.get("x-wc-webhook-source");

    if (!verifyWooCommerceWebhook(rawBody, signature)) {
      logger.warn("woocommerce/webhook", "Signature invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    if (topic !== "order.created") {
      return NextResponse.json({ received: true });
    }

    const payload: WooCommerceOrderPayload = JSON.parse(rawBody);

    if (!isWooCommerceCOD(payload.payment_method)) {
      return NextResponse.json({
        received: true,
        action: "ignored_non_cod",
        payment_method: payload.payment_method,
      });
    }

    // Extraction du domaine depuis le header X-WC-Webhook-Source
    let domain: string | null = null;
    try {
      if (sourceUrl) domain = new URL(sourceUrl).hostname;
    } catch {
      /* ignore */
    }

    const organization = await resolveOrganizationByWoocommerceDomain(domain);
    if (!organization) {
      logger.error(
        "woocommerce/webhook",
        "Aucune organisation mappée sur ce domaine",
        { domain, sourceUrl }
      );
      return NextResponse.json(
        {
          error:
            "Aucune organisation associée. Configurez votre domaine WooCommerce dans les paramètres.",
        },
        { status: 404 }
      );
    }

    const firstName =
      payload.shipping?.first_name || payload.billing?.first_name || "";
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

    const isNew = await markWebhookProcessed({
      provider: "woocommerce",
      externalId: `order_${payload.id}`,
      organizationId: organization.id,
      payload,
    });
    if (!isNew) {
      return NextResponse.json({ received: true, action: "duplicate_ignored" });
    }

    const existing = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organization.id),
          eq(orders.source, "woocommerce"),
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

    const address = [
      payload.shipping?.address_1 || payload.billing?.address_1,
      payload.shipping?.city || payload.billing?.city,
      payload.shipping?.country || payload.billing?.country,
    ]
      .filter(Boolean)
      .join(", ");

    const [insertedOrder] = await db
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

    await db.insert(notifications).values({
      organizationId: organization.id,
      type: "order_received",
      title: "Nouvelle commande WooCommerce",
      body: `${customerName} — ${payload.total} ${payload.currency}`,
      link: `/dashboard/e-commerce`,
    });

    logger.info("woocommerce/webhook", "Commande COD créée", {
      orderId: insertedOrder.id,
      organizationId: organization.id,
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    fetch(`${baseUrl}/api/calls/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalHeader() },
      body: JSON.stringify({ orderId: insertedOrder.id }),
      signal: AbortSignal.timeout(10_000),
    }).catch((err) => {
      logger.error("woocommerce/webhook", "Erreur déclenchement appel", {
        err: String(err),
      });
    });

    return NextResponse.json({
      received: true,
      orderId: insertedOrder.id,
      action: "call_initiated",
    });
  } catch (error) {
    logger.error("woocommerce/webhook", "Erreur serveur", {
      error: String(error),
    });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
