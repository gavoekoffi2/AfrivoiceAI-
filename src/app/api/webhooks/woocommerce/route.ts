import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { normalizePhoneNumber } from "@/lib/utils";
import {
  verifyWooCommerceWebhook,
  isWooCommerceCOD,
} from "@/lib/woocommerce/verify";
import { woocommerceOrderSchema } from "@/lib/validations/webhooks";
import { recordWebhookEvent } from "@/lib/webhooks/idempotency";
import { resolveOrganizationForWooCommerce } from "@/lib/organizations/resolver";
import { triggerCall } from "@/lib/calls/trigger";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("woocommerce/webhook");

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`woocommerce:${ip}`, 100, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const signature = req.headers.get("x-wc-webhook-signature");
  const topic = req.headers.get("x-wc-webhook-topic");
  const sourceDomain = req.headers.get("x-wc-webhook-source");
  const eventId =
    req.headers.get("x-wc-webhook-id") ??
    `${sourceDomain ?? "woo"}:${Date.now()}`;
  const url = new URL(req.url);

  if (!verifyWooCommerceWebhook(rawBody, signature)) {
    log.warn("Signature invalide");
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  if (topic && topic !== "order.created") {
    return NextResponse.json({ received: true, action: "ignored_topic" });
  }

  let payload;
  try {
    payload = woocommerceOrderSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    log.warn("Payload invalide", { error: String(err) });
    return NextResponse.json({ error: "Payload invalide" }, { status: 422 });
  }

  const sourceHost = sourceDomain
    ? (() => {
        try {
          return new URL(sourceDomain).hostname;
        } catch {
          return sourceDomain;
        }
      })()
    : null;

  const organization = await resolveOrganizationForWooCommerce(url, sourceHost);
  if (!organization) {
    log.warn("Aucune organisation associée", { sourceHost });
    return NextResponse.json(
      {
        error:
          "Organisation introuvable. Configurez votre webhook avec ?token=… ou enregistrez le domaine de votre boutique.",
      },
      { status: 404 }
    );
  }

  const { isNew } = await recordWebhookEvent({
    source: "woocommerce",
    externalEventId: eventId,
    organizationId: organization.id,
    payload,
  });
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!isWooCommerceCOD(payload.payment_method)) {
    return NextResponse.json({
      received: true,
      action: "ignored_non_cod",
    });
  }

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

  const address =
    [
      payload.shipping?.address_1 || payload.billing?.address_1,
      payload.shipping?.city || payload.billing?.city,
      payload.shipping?.country || payload.billing?.country,
    ]
      .filter(Boolean)
      .join(", ") || null;

  let insertedOrder;
  try {
    [insertedOrder] = await db
      .insert(orders)
      .values({
        organizationId: organization.id,
        externalId: payload.id,
        source: "woocommerce",
        customerName,
        customerPhone: normalizedPhone,
        customerAddress: address,
        totalAmount: payload.total ?? null,
        currency: payload.currency || "XOF",
        status: "pending",
        rawPayload: payload as never,
      })
      .onConflictDoNothing({
        target: [orders.organizationId, orders.source, orders.externalId],
      })
      .returning();
  } catch (err) {
    log.error("Insertion commande échouée", { error: String(err) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  if (!insertedOrder) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  log.info("Commande COD créée", {
    orderId: insertedOrder.id,
    organizationId: organization.id,
  });

  triggerCall({
    organizationId: organization.id,
    orderId: insertedOrder.id,
  }).catch((err) =>
    log.error("Échec déclenchement appel", {
      error: String(err),
      orderId: insertedOrder!.id,
    })
  );

  return NextResponse.json({
    received: true,
    orderId: insertedOrder.id,
    action: "order_created",
  });
}
