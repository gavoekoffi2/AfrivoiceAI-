import { db } from "@/lib/db";
import { orders, calls, wallets, campaigns, leads, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getVapiClient,
  generateEcommercePrompt,
  generateProspectingPrompt,
} from "@/lib/vapi/client";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { normalizePhoneNumber } from "@/lib/utils";

export type InitiateResult =
  | { ok: true; callId: string }
  | {
      ok: false;
      code: "insufficient_balance" | "not_found" | "vapi_error";
      message: string;
    };

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

// Extraction déterministe de l'issue par Vapi (call.analysis.structuredData),
// indépendante du résumé conversationnel. Voir lib/calls/outcome.ts.
const ECOMMERCE_ANALYSIS_PLAN = {
  structuredDataPlan: {
    enabled: true,
    schema: {
      type: "object" as const,
      properties: {
        outcome: {
          type: "string",
          enum: ["confirmed", "cancelled", "no_answer"],
          description:
            "Issue de l'appel de confirmation de commande. 'confirmed' si le client confirme/accepte la commande ; 'cancelled' s'il annule, refuse ou n'est pas intéressé ; 'no_answer' s'il n'y a pas eu de réponse (messagerie, injoignable).",
        },
      },
      required: ["outcome"],
    },
  },
};

const PROSPECTING_ANALYSIS_PLAN = {
  structuredDataPlan: {
    enabled: true,
    schema: {
      type: "object" as const,
      properties: {
        qualified: {
          type: "boolean",
          description:
            "true si le prospect est intéressé/qualifié par rapport à l'objectif de l'appel, false sinon.",
        },
      },
      required: ["qualified"],
    },
  },
};

function requireVapiConfig() {
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("VAPI_PHONE_NUMBER_ID non configuré");
  }
  return { phoneNumberId };
}

/**
 * Lance un appel de confirmation de commande e-commerce via Vapi puis
 * enregistre l'appel et bascule la commande en statut "calling".
 * Logique partagée entre l'API dashboard et les webhooks e-commerce.
 */
export async function initiateEcommerceCall(
  order: typeof orders.$inferSelect,
  organizationId: string
): Promise<InitiateResult> {
  const walletResult = await db
    .select()
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);

  const wallet = walletResult[0];
  if (!wallet || !hasSufficientBalance(wallet.balanceFcfa)) {
    return {
      ok: false,
      code: "insufficient_balance",
      message: "Solde insuffisant. Rechargez votre wallet.",
    };
  }

  const orgResult = await db
    .select({ shopName: organizations.shopName, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const shopName =
    orgResult[0]?.shopName ?? orgResult[0]?.name ?? "Notre Boutique";

  const systemPrompt = generateEcommercePrompt({
    customerName: order.customerName,
    shopName,
    orderAmount: order.totalAmount ?? "N/A",
    currency: order.currency,
    address: order.customerAddress ?? "adresse non précisée",
    orderId: order.externalId,
  });

  try {
    const { phoneNumberId } = requireVapiConfig();
    const vapi = getVapiClient();

    const callResponse = await vapi.calls.create({
      phoneNumberId,
      customer: {
        number: order.customerPhone,
        name: order.customerName,
      },
      assistant: {
        model: {
          provider: "google",
          model: "gemini-1.5-flash",
          messages: [{ role: "system", content: systemPrompt }],
          maxTokens: 250,
          temperature: 0.7,
        },
        voice: {
          provider: "11labs",
          voiceId: process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID,
        },
        firstMessage: `Bonjour ${order.customerName}, c'est Amina de la boutique ${shopName}. Je vous appelle pour confirmer votre commande. Avez-vous quelques instants ?`,
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
        analysisPlan: ECOMMERCE_ANALYSIS_PLAN,
      },
    });

    // calls.create renvoie Call | CallBatchResponse ; on n'utilise que le mode
    // appel unique (un seul `customer`), qui renvoie un Call avec `id`.
    if (!("id" in callResponse)) {
      throw new Error("Réponse Vapi inattendue (batch non supporté)");
    }

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId: callResponse.id,
        orderId: order.id,
        type: "ecommerce_confirmation",
        status: "queued",
      });

      await tx
        .update(orders)
        .set({ status: "calling" })
        .where(eq(orders.id, order.id));
    });

    console.log(
      `[calls/initiate] Appel e-commerce lancé: ${callResponse.id} pour commande ${order.id}`
    );

    return { ok: true, callId: callResponse.id };
  } catch (vapiError) {
    console.error("[calls/initiate] Erreur Vapi:", vapiError);
    // Réinitialiser le statut de la commande pour permettre une relance.
    await db
      .update(orders)
      .set({ status: "pending" })
      .where(eq(orders.id, order.id));

    return {
      ok: false,
      code: "vapi_error",
      message: "Impossible de lancer l'appel via Vapi",
    };
  }
}

/**
 * Lance un appel de prospection pour un lead d'une campagne.
 */
export async function initiateProspectingCall(
  leadId: string,
  campaignId: string,
  organizationId: string
): Promise<InitiateResult> {
  const walletResult = await db
    .select()
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);

  if (!walletResult[0] || !hasSufficientBalance(walletResult[0].balanceFcfa)) {
    return {
      ok: false,
      code: "insufficient_balance",
      message: "Solde insuffisant.",
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
      ok: false,
      code: "not_found",
      message: "Lead ou campagne introuvable",
    };
  }

  const phone = normalizePhoneNumber(lead.phone, "TG") ?? lead.phone;

  const systemPrompt = generateProspectingPrompt({
    objective: campaign.objective,
    scriptTemplate: campaign.scriptTemplate,
    leadName: lead.name ?? undefined,
    companyName: lead.company ?? undefined,
  });

  try {
    const { phoneNumberId } = requireVapiConfig();
    const vapi = getVapiClient();

    const callResponse = await vapi.calls.create({
      phoneNumberId,
      customer: {
        number: phone,
        name: lead.name ?? undefined,
      },
      assistant: {
        model: {
          provider: "google",
          model: "gemini-1.5-flash",
          messages: [{ role: "system", content: systemPrompt }],
          maxTokens: 300,
          temperature: 0.7,
        },
        voice: {
          provider: "11labs",
          voiceId: process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID,
        },
        firstMessage: lead.name
          ? `Bonjour ${lead.name}, comment allez-vous ?`
          : "Bonjour, comment allez-vous ?",
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
        analysisPlan: PROSPECTING_ANALYSIS_PLAN,
      },
    });

    if (!("id" in callResponse)) {
      throw new Error("Réponse Vapi inattendue (batch non supporté)");
    }

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId: callResponse.id,
        leadId,
        type: "prospecting",
        status: "queued",
      });

      await tx
        .update(leads)
        .set({ status: "called" })
        .where(eq(leads.id, leadId));
    });

    return { ok: true, callId: callResponse.id };
  } catch (vapiError) {
    console.error("[calls/initiate/prospecting] Erreur Vapi:", vapiError);
    return {
      ok: false,
      code: "vapi_error",
      message: "Impossible de lancer l'appel Vapi",
    };
  }
}
