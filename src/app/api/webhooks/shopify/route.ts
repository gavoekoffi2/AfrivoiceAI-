import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { verifyShopifyWebhook, isCashOnDelivery } from "@/lib/shopify/verify";
import { normalizePhoneNumber } from "@/lib/utils";
import { shopifyOrderSchema } from "@/lib/validations/webhooks";
import { recordWebhookEvent } from "@/lib/webhooks/idempotency";
import { resolveOrganizationForShopify } from "@/lib/organizations/resolver";
import { triggerCall } from "@/lib/calls/trigger";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { createLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const log = createLogger("shopify/webhook");

export async function POST(req: Request) {
  // Rate-limit basique par IP pour éviter les bursts
  const ip = getClientIp(req);
  const rl = rateLimit(`shopify:${ip}`, 100, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const signature = req.headers.get("x-shopify-hmac-sha256");
  const shopDomain = req.headers.get("x-shopify-shop-domain");
  const topic = req.headers.get("x-shopify-topic");
  const shopifyEventId =
    req.headers.get("x-shopify-webhook-id") ?? `${shopDomain}:${Date.now()}`;
  const url = new URL(req.url);

  if (!verifyShopifyWebhook(rawBody, signature)) {
    log.warn("Signature invalide", { shopDomain });
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  // Ne traiter que les créations de commande
  if (topic && topic !== "orders/create") {
    return NextResponse.json({ received: true, action: "ignored_topic" });
  }

  let payload;
  try {
    payload = shopifyOrderSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    log.warn("Payload invalide", { error: String(err) });
    return NextResponse.json({ error: "Payload invalide" }, { status: 422 });
  }

  // Multi-tenant : on résout l'organisation par token ou par domaine
  const organization = await resolveOrganizationForShopify(url, shopDomain);
  if (!organization) {
    log.warn("Aucune organisation associée", { shopDomain });
    return NextResponse.json(
      {
        error:
          "Organisation introuvable. Configurez votre webhook avec ?token=… ou enregistrez le domaine de votre boutique dans les paramètres.",
      },
      { status: 404 }
    );
  }

  // Rate-limit par organisation (en plus de l'IP) pour éviter qu'un tenant
  // ne sature le service avec ses webhooks.
  const rlOrg = rateLimit(`shopify:org:${organization.id}`, 300, 60_000);
  if (!rlOrg.success) {
    return NextResponse.json(
      { error: "Quota webhook organisation dépassé" },
      { status: 429 }
    );
  }

  // Idempotency
  const { isNew } = await recordWebhookEvent({
    source: "shopify",
    externalEventId: shopifyEventId,
    organizationId: organization.id,
    payload,
  });
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Filtrage COD
  if (!isCashOnDelivery(payload.gateway ?? undefined)) {
    return NextResponse.json({ received: true, action: "ignored_non_cod" });
  }

  // Extraction client
  const customerName =
    [payload.customer?.first_name, payload.customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "Client";

  const rawPhone =
    payload.shipping_address?.phone ??
    payload.customer?.phone ??
    payload.billing_address?.phone ??
    null;

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

  const customerAddress =
    [
      payload.shipping_address?.address1,
      payload.shipping_address?.city,
      payload.shipping_address?.country,
    ]
      .filter(Boolean)
      .join(", ") || null;

  // Insertion (ignore les doublons via l'index unique org/source/external)
  let insertedOrder;
  try {
    [insertedOrder] = await db
      .insert(orders)
      .values({
        organizationId: organization.id,
        externalId: payload.id,
        source: "shopify",
        customerName,
        customerPhone: normalizedPhone,
        customerAddress,
        totalAmount: payload.total_price ?? null,
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
    // Doublon : on accuse réception sans relancer l'appel
    return NextResponse.json({ received: true, duplicate: true });
  }

  log.info("Commande COD créée", {
    orderId: insertedOrder.id,
    organizationId: organization.id,
  });

  // Déclenchement asynchrone — en serverless, on doit attendre, sinon la
  // requête est tuée avant exécution. Pour ne pas faire timeout le webhook
  // Shopify (3s max), on enchaîne via une promesse non-await avec retour 200.
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
