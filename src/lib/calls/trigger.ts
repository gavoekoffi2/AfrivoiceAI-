import { db } from "@/lib/db";
import {
  orders,
  calls,
  campaigns,
  leads,
  organizations,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
        | "config_error";
      message: string;
    };

/**
 * Déclenche un appel — commande e-commerce OU lead de campagne.
 * À utiliser depuis les webhooks (Shopify/Woo) ET le dashboard.
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

    const [dbCall] = await db.transaction(async (tx) => {
      const result = await tx
        .insert(calls)
        .values({
          organizationId,
          vapiCallId: callResponse.id,
          orderId: order.id,
          type: "ecommerce_confirmation",
          status: "queued",
        })
        .returning();

      await tx
        .update(orders)
        .set({
          status: "calling",
          callAttempts: order.callAttempts + 1,
          lastCallAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      return result;
    });

    log.info("Appel e-commerce lancé", {
      vapiCallId: callResponse.id,
      orderId: order.id,
    });

    return {
      success: true,
      callId: dbCall.id,
      vapiCallId: callResponse.id,
    };
  } catch (err) {
    log.error("Erreur création appel Vapi", { error: String(err) });
    // Rollback statut commande
    await db
      .update(orders)
      .set({ status: "pending" })
      .where(eq(orders.id, order.id));
    return {
      success: false,
      reason: "vapi_error",
      message: "Impossible de lancer l'appel via Vapi",
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

    const [dbCall] = await db.transaction(async (tx) => {
      const result = await tx
        .insert(calls)
        .values({
          organizationId,
          vapiCallId: callResponse.id,
          leadId,
          type: "prospecting",
          status: "queued",
        })
        .returning();

      await tx
        .update(leads)
        .set({ status: "called", callAttempts: lead.callAttempts + 1 })
        .where(eq(leads.id, leadId));

      return result;
    });

    log.info("Appel prospection lancé", {
      vapiCallId: callResponse.id,
      leadId,
    });

    return {
      success: true,
      callId: dbCall.id,
      vapiCallId: callResponse.id,
    };
  } catch (err) {
    log.error("Erreur création appel Vapi", { error: String(err) });
    return {
      success: false,
      reason: "vapi_error",
      message: "Impossible de lancer l'appel via Vapi",
    };
  }
}
