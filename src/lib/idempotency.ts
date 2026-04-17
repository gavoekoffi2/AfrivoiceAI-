import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";

/**
 * Retourne true si l'event n'a jamais été traité (et l'enregistre).
 * Retourne false s'il existait déjà (idempotent : deuxième livraison du webhook).
 */
export async function markWebhookProcessed(params: {
  provider: "shopify" | "woocommerce" | "vapi" | "stripe";
  externalId: string;
  organizationId?: string | null;
  payload?: unknown;
}): Promise<boolean> {
  try {
    await db.insert(webhookEvents).values({
      provider: params.provider,
      externalId: params.externalId,
      organizationId: params.organizationId ?? null,
      payload: (params.payload ?? null) as Record<string, unknown> | null,
    });
    return true;
  } catch (err) {
    // Violation d'unique (provider + externalId) — déjà traité.
    const code = (err as { code?: string } | undefined)?.code;
    if (code === "23505") return false;
    throw err;
  }
}
