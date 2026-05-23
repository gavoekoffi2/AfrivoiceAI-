import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";

/**
 * Empêche le retraitement d'un webhook déjà vu.
 * Retourne `true` si le retraitement doit avoir lieu (= nouveau),
 * `false` si le webhook a déjà été traité.
 *
 * S'appuie sur l'index unique (source, external_event_id) en DB.
 */
export async function recordWebhookEvent(params: {
  source: "vapi" | "shopify" | "woocommerce" | "stripe";
  externalEventId: string;
  organizationId?: string;
  payload?: unknown;
}): Promise<{ isNew: boolean }> {
  try {
    await db.insert(webhookEvents).values({
      source: params.source,
      externalEventId: params.externalEventId,
      organizationId: params.organizationId,
      payload: params.payload as never,
    });
    return { isNew: true };
  } catch (err) {
    // L'index unique a tranché : événement déjà vu
    const msg = String(err);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { isNew: false };
    }
    throw err;
  }
}
