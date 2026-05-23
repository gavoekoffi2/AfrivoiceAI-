import { db } from "@/lib/db";
import {
  orders,
  calls,
  campaigns,
  leads,
  organizations,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  createVapiCallWithRetry,
  buildAssistantConfig,
  generateEcommercePrompt,
  generateProspectingPrompt,
  ECOMMERCE_OUTCOME_TOOL,
  PROSPECTING_OUTCOME_TOOL,
} from "@/lib/vapi/client";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { getBalance } from "@/lib/wallet/service";
import { normalizePhoneNumber } from "@/lib/utils";
import { requireEnv } from "@/lib/utils/env";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("calls/trigger");

export type TriggerResult =
  | { success: true; callId: string; vapiCallId: string }
  | {
      success: false;
      reason:
        | "insufficient_balance"
        | "not_found"
        | "invalid_phone"
        | "vapi_error"
        | "config_error"
        | "already_calling";
      message: string;
    };

/**
 * Déclenche un appel — commande e-commerce OU lead de campagne.
 * À utiliser depuis les webhooks (Shopify/Woo) ET le dashboard.
 *
 * Stratégie d'intégrité :
 *  1) Réservation atomique en DB (status `calling`, insertion call placeholder)
 *  2) Appel Vapi
 *  3) UPDATE du vapiCallId dans la ligne calls
 *
 * Si Vapi échoue après réservation : on rollback (suppression call + statut
 * order/lead remis à pending/new) UNIQUEMENT si le statut actuel est encore
 * celui qu'on a posé (anti race-condition).
 */
export async function triggerCall(input: {
  organizationId: string;
  orderId?: string;
  leadId?: string;
  campaignId?: string;
}): Promise<TriggerResult> {
  if (input.orderId) {
    return triggerEcommerceCall(input.organizationId, input.orderId);
  }
  if (input.leadId && input.campaignId) {
    return triggerProspectingCall(
      input.organizationId,
      input.leadId,
      input.campaignId
    );
  }
  return {
    success: false,
    reason: "not_found",
    message: "Paramètres manquants : orderId ou (leadId + campaignId)",
  };
}

async function triggerEcommerceCall(
  organizationId: string,
  orderId: string
): Promise<TriggerResult> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)))
    .limit(1);
  if (!order) {
    return { success: false, reason: "not_found", message: "Commande introuvable" };
  }

  if (order.status === "calling") {
    return {
      success: false,
      reason: "already_calling",
      message: "Un appel est déjà en cours pour cette commande.",
    };
  }

  const balance = await getBalance(organizationId);
  if (!hasSufficientBalance(balance)) {
    return {
      success: false,
      reason: "insufficient_balance",
      message: "Solde insuffisant pour lancer l'appel.",
    };
  }

  const [org] = await db
    .select({ shopName: organizations.shopName, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const shopName = org?.shopName ?? org?.name ?? "Notre Boutique";

  const phone = normalizePhoneNumber(order.customerPhone, "TG");
  if (!phone) {
    return {
      success: false,
      reason: "invalid_phone",
      message: "Numéro de téléphone invalide",
    };
  }

  let phoneNumberId: string;
  try {
    phoneNumberId = requireEnv("VAPI_PHONE_NUMBER_ID");
  } catch {
    return {
      success: false,
      reason: "config_error",
      message: "VAPI_PHONE_NUMBER_ID non configuré",
    };
  }

  const systemPrompt = generateEcommercePrompt({
    customerName: order.customerName,
    shopName,
    orderAmount: order.totalAmount ?? "N/A",
    currency: order.currency,
    address: order.customerAddress ?? "adresse non précisée",
    orderId: order.externalId,
  });

  // 1) Réservation atomique — on ne pose `calling` que si l'order est encore
  //    dans un état "appelable". Évite les doubles appels concurrents.
  const reservation = await db
    .update(orders)
    .set({
      status: "calling",
      callAttempts: sql`${orders.callAttempts} + 1`,
      lastCallAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, order.id),
        sql`status IN ('pending', 'no_answer', 'cancelled')`
      )
    )
    .returning({ id: orders.id, previousStatus: orders.status });

  if (reservation.length === 0) {
    return {
      success: false,
      reason: "already_calling",
      message: "Un appel est déjà en cours pour cette commande.",
    };
  }

  // 2) Appel Vapi
  let vapiCallId: string;
  try {
    const callResponse = await createVapiCallWithRetry({
      phoneNumberId,
      customer: { number: phone, name: order.customerName },
      assistant: buildAssistantConfig({
        systemPrompt,
        firstMessage: `Bonjour ${order.customerName}, c'est Amina de la boutique ${shopName}. Je vous appelle pour confirmer votre commande. Avez-vous quelques instants ?`,
        outcomeTool: ECOMMERCE_OUTCOME_TOOL,
      }),
    });
    vapiCallId = callResponse.id;
  } catch (err) {
    log.error("Vapi a refusé l'appel — rollback statut commande", {
      error: String(err),
      orderId: order.id,
    });
    // Rollback seulement si le statut est encore `calling` (race-safe)
    await db
      .update(orders)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, "calling")));
    return {
      success: false,
      reason: "vapi_error",
      message: "Impossible de lancer l'appel via Vapi",
    };
  }

  // 3) Persiste l'enregistrement call. Si l'INSERT rate, on a au moins le
  //    statut `calling` à débugger côté ops.
  try {
    const [dbCall] = await db
      .insert(calls)
      .values({
        organizationId,
        vapiCallId,
        orderId: order.id,
        type: "ecommerce_confirmation",
        status: "queued",
      })
      .returning();

    log.info("Appel e-commerce lancé", {
      vapiCallId,
      orderId: order.id,
      callId: dbCall.id,
    });

    return { success: true, callId: dbCall.id, vapiCallId };
  } catch (err) {
    log.error("INSERT calls a échoué après création Vapi — orphelin possible", {
      error: String(err),
      vapiCallId,
      orderId: order.id,
    });
    return {
      success: false,
      reason: "vapi_error",
      message: "Erreur de persistance après création de l'appel",
    };
  }
}

async function triggerProspectingCall(
  organizationId: string,
  leadId: string,
  campaignId: string
): Promise<TriggerResult> {
  const balance = await getBalance(organizationId);
  if (!hasSufficientBalance(balance)) {
    return {
      success: false,
      reason: "insufficient_balance",
      message: "Solde insuffisant",
    };
  }

  const [leadResult, campaignResult] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, organizationId)))
      .limit(1),
    db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, organizationId)
        )
      )
      .limit(1),
  ]);

  const lead = leadResult[0];
  const campaign = campaignResult[0];
  if (!lead || !campaign) {
    return {
      success: false,
      reason: "not_found",
      message: "Lead ou campagne introuvable",
    };
  }

  const phone = normalizePhoneNumber(lead.phone, "TG");
  if (!phone) {
    return {
      success: false,
      reason: "invalid_phone",
      message: "Numéro de téléphone invalide",
    };
  }

  let phoneNumberId: string;
  try {
    phoneNumberId = requireEnv("VAPI_PHONE_NUMBER_ID");
  } catch {
    return {
      success: false,
      reason: "config_error",
      message: "VAPI_PHONE_NUMBER_ID non configuré",
    };
  }

  const systemPrompt = generateProspectingPrompt({
    objective: campaign.objective,
    scriptTemplate: campaign.scriptTemplate,
    leadName: lead.name ?? undefined,
    companyName: lead.company ?? undefined,
  });

  // 1) Réservation : on passe le lead en "calling" depuis (new|queueing|no_answer)
  const reservation = await db
    .update(leads)
    .set({
      status: "calling",
      callAttempts: sql`${leads.callAttempts} + 1`,
    })
    .where(
      and(
        eq(leads.id, leadId),
        sql`status IN ('new', 'queueing', 'no_answer')`
      )
    )
    .returning({ id: leads.id });

  if (reservation.length === 0) {
    return {
      success: false,
      reason: "already_calling",
      message: "Ce lead a déjà un appel en cours ou est dans un état terminal.",
    };
  }

  // 2) Appel Vapi
  let vapiCallId: string;
  try {
    const callResponse = await createVapiCallWithRetry({
      phoneNumberId,
      customer: { number: phone, name: lead.name ?? undefined },
      assistant: buildAssistantConfig({
        systemPrompt,
        firstMessage: lead.name
          ? `Bonjour ${lead.name}, comment allez-vous ?`
          : "Bonjour, comment allez-vous ?",
        outcomeTool: PROSPECTING_OUTCOME_TOOL,
        voiceId: campaign.voiceId ?? undefined,
      }),
    });
    vapiCallId = callResponse.id;
  } catch (err) {
    log.error("Vapi a refusé l'appel — rollback lead", {
      error: String(err),
      leadId,
    });
    // Rollback seulement si encore en `calling`
    await db
      .update(leads)
      .set({ status: "new" })
      .where(and(eq(leads.id, leadId), eq(leads.status, "calling")));
    return {
      success: false,
      reason: "vapi_error",
      message: "Impossible de lancer l'appel Vapi",
    };
  }

  // 3) Persiste l'enregistrement call
  try {
    const [dbCall] = await db
      .insert(calls)
      .values({
        organizationId,
        vapiCallId,
        leadId,
        type: "prospecting",
        status: "queued",
      })
      .returning();

    // Marque le lead comme appelé (l'appel est en cours côté Vapi)
    await db
      .update(leads)
      .set({ status: "called" })
      .where(and(eq(leads.id, leadId), eq(leads.status, "calling")));

    log.info("Appel prospection lancé", {
      vapiCallId,
      leadId,
      callId: dbCall.id,
    });

    return { success: true, callId: dbCall.id, vapiCallId };
  } catch (err) {
    log.error("INSERT calls a échoué après création Vapi — orphelin possible", {
      error: String(err),
      vapiCallId,
      leadId,
    });
    return {
      success: false,
      reason: "vapi_error",
      message: "Erreur de persistance après création de l'appel",
    };
  }
}
