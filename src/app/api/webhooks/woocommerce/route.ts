import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { normalizePhoneNumber } from "@/lib/utils";
import { resolveWebhookOrganization } from "@/lib/webhooks";
import { initiateOrderCall } from "@/lib/calls/initiate";

interface WooCommerceOrderPayload {
  id?: number;
  status?: string;
  total?: string;
  currency?: string;
  payment_method?: string;
  payment_method_title?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address_1?: string;
    city?: string;
    country?: string;
  };
  shipping?: {
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
  if (!secret) return true; // Pas de secret configuré, accepter en dev

  if (!signature) return false;

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

    if (!verifyWooCommerceWebhook(rawBody, signature)) {
      console.warn("[woocommerce/webhook] Signature invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    // Ne traiter que les créations de commande
    if (topic !== "order.created") {
      return NextResponse.json({ received: true });
    }

    // WooCommerce envoie un "ping" non-JSON (webhook_id=...) à l'activation
    // du webhook : il faut répondre 200 sinon l'activation échoue.
    let payload: WooCommerceOrderPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ received: true, action: "ping_acknowledged" });
    }

    if (payload.id === undefined || payload.id === null) {
      return NextResponse.json({ received: true, action: "ignored_no_id" });
    }

    // Vérifier si c'est une commande COD
    if (!payload.payment_method || !isWooCommerceCOD(payload.payment_method)) {
      return NextResponse.json({
        received: true,
        action: "ignored_non_cod",
        payment_method: payload.payment_method,
      });
    }

    // Identifier l'organisation destinataire (?org=<id> dans l'URL du webhook)
    const organization = await resolveWebhookOrganization(req.url);
    if (!organization) {
      return NextResponse.json(
        { error: "Organisation introuvable — vérifiez le paramètre ?org= de l'URL du webhook" },
        { status: 404 }
      );
    }

    const externalId = payload.id.toString();

    // Idempotence : WooCommerce relivre les webhooks en cas de timeout
    const existing = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organization.id),
          eq(orders.source, "woocommerce"),
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

    // Extraire les données client (shipping > billing)
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
        organizationId: organization.id,
        externalId,
        source: "woocommerce",
        customerName,
        customerPhone: normalizedPhone,
        customerAddress: address || null,
        totalAmount: payload.total ?? null,
        currency: payload.currency || "XOF",
        status: "pending",
        rawPayload: payload as unknown as Record<string, unknown>,
      })
      .returning();

    console.log(
      `[woocommerce/webhook] Commande COD créée: ${insertedOrder[0].id} pour ${customerName}`
    );

    // Déclencher l'appel de confirmation (appel direct, sans HTTP interne)
    const callResult = await initiateOrderCall(insertedOrder[0]).catch(
      (err) => {
        console.error(`[woocommerce/webhook] Erreur déclenchement appel:`, err);
        return null;
      }
    );

    return NextResponse.json({
      received: true,
      orderId: insertedOrder[0].id,
      action: callResult?.ok ? "call_initiated" : "order_created",
    });
  } catch (error) {
    console.error("[woocommerce/webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
