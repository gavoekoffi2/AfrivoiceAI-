import { db } from "@/lib/db";
import {
  orders,
  calls,
  wallets,
  campaigns,
  leads,
  organizations,
  type Order,
  type Lead,
  type Campaign,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  getVapiClient,
  getCreatedCallId,
  buildAssistantConfig,
  generateEcommercePrompt,
  generateProspectingPrompt,
} from "@/lib/vapi/client";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { normalizePhoneNumber } from "@/lib/utils";
import { buildProspectingFirstMessage } from "@/lib/prospecting";

export type InitiateCallResult =
  | { ok: true; vapiCallId: string }
  | { ok: false; status: number; error: string };

// Statuts de commande pour lesquels un (nouvel) appel est autorisé
const CALLABLE_ORDER_STATUSES = new Set(["pending", "no_answer"]);

async function getWalletBalance(organizationId: string) {
  const walletResult = await db
    .select({ balance: wallets.balanceFcfa })
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);
  return walletResult[0]?.balance ?? null;
}

/**
 * Lance l'appel IA de confirmation pour une commande COD.
 * Utilisé par l'API dashboard ET directement par les webhooks e-commerce.
 */
export async function initiateOrderCall(
  order: Order,
  options: { force?: boolean } = {}
): Promise<InitiateCallResult> {
  if (!options.force && !CALLABLE_ORDER_STATUSES.has(order.status)) {
    return {
      ok: false,
      status: 409,
      error: `La commande est déjà en statut "${order.status}".`,
    };
  }

  const balance = await getWalletBalance(order.organizationId);
  if (balance === null || !hasSufficientBalance(balance)) {
    return {
      ok: false,
      status: 402,
      error: "Solde insuffisant. Rechargez votre wallet.",
    };
  }

  const orgResult = await db
    .select({ shopName: organizations.shopName, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, order.organizationId))
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

  const phone =
    normalizePhoneNumber(order.customerPhone, "TG") ?? order.customerPhone;

  try {
    const vapi = getVapiClient();
    const callResponse = await vapi.calls.create({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: { number: phone, name: order.customerName },
      assistant: buildAssistantConfig({
        systemPrompt,
        firstMessage: `Bonjour ${order.customerName}, c'est Amina de la boutique ${shopName}. Je vous appelle pour confirmer votre commande. Avez-vous quelques instants ?`,
        endCallMessage:
          "Merci beaucoup. Je vous souhaite une excellente journée.",
        maxTokens: 250,
      }),
    });
    const vapiCallId = getCreatedCallId(callResponse);

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId: order.organizationId,
        vapiCallId,
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
      `[calls/initiate] Appel e-commerce lancé: ${vapiCallId} pour commande ${order.id}`
    );
    return { ok: true, vapiCallId };
  } catch (vapiError) {
    console.error("[calls/initiate] Erreur Vapi:", vapiError);
    await db
      .update(orders)
      .set({ status: "pending" })
      .where(eq(orders.id, order.id));
    return {
      ok: false,
      status: 503,
      error: "Impossible de lancer l'appel via Vapi",
    };
  }
}

/**
 * Lance l'appel IA de prospection pour un lead donné d'une campagne.
 */
export async function initiateLeadCall(params: {
  lead: Lead;
  campaign: Campaign;
}): Promise<InitiateCallResult> {
  const { lead, campaign } = params;

  const balance = await getWalletBalance(lead.organizationId);
  if (balance === null || !hasSufficientBalance(balance)) {
    return { ok: false, status: 402, error: "Solde insuffisant." };
  }

  const phone = normalizePhoneNumber(lead.phone, "TG") ?? lead.phone;

  const systemPrompt = generateProspectingPrompt({
    objective: campaign.objective,
    scriptTemplate: campaign.scriptTemplate,
    leadName: lead.name ?? undefined,
    companyName: lead.company ?? undefined,
  });

  try {
    const vapi = getVapiClient();
    const callResponse = await vapi.calls.create({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: { number: phone, name: lead.name ?? undefined },
      assistant: buildAssistantConfig({
        systemPrompt,
        firstMessage: buildProspectingFirstMessage({
          leadName: lead.name,
          companyName: lead.company,
        }),
        endCallMessage:
          "Merci pour votre temps. Je vous souhaite une excellente journée.",
      }),
    });
    const vapiCallId = getCreatedCallId(callResponse);

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId: lead.organizationId,
        vapiCallId,
        leadId: lead.id,
        type: "prospecting",
        status: "queued",
      });

      await tx
        .update(leads)
        .set({ status: "called" })
        .where(eq(leads.id, lead.id));

      await tx
        .update(campaigns)
        .set({ calledLeads: sql`${campaigns.calledLeads} + 1` })
        .where(eq(campaigns.id, campaign.id));
    });

    console.log(
      `[calls/initiate] Appel prospection lancé: ${vapiCallId} → ${phone}`
    );
    return { ok: true, vapiCallId };
  } catch (vapiError) {
    console.error("[calls/initiate/prospecting] Erreur Vapi:", vapiError);
    return {
      ok: false,
      status: 503,
      error: "Impossible de lancer l'appel Vapi",
    };
  }
}

/**
 * Lance un appel de démonstration vers le numéro du nouvel utilisateur :
 * c'est le moyen le plus rapide de valider toute la chaîne (Vapi, voix,
 * webhook, facturation) sans importer de leads ni brancher une boutique.
 */
export async function initiateTestCall(params: {
  organizationId: string;
  phone: string;
  name?: string;
}): Promise<InitiateCallResult> {
  const balance = await getWalletBalance(params.organizationId);
  if (balance === null || !hasSufficientBalance(balance)) {
    return {
      ok: false,
      status: 402,
      error: "Solde insuffisant. Rechargez votre wallet pour tester un appel.",
    };
  }

  const phone = normalizePhoneNumber(params.phone, "TG");
  if (!phone) {
    return {
      ok: false,
      status: 422,
      error:
        "Numéro de téléphone invalide. Utilisez le format international, ex: +228 90 00 00 00.",
    };
  }

  const orgResult = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, params.organizationId))
    .limit(1);
  const orgName = orgResult[0]?.name ?? "votre entreprise";

  const displayName = params.name?.trim() || "cher utilisateur";

  const systemPrompt = `Tu es Amina, l'assistante vocale de démonstration d'AfrivoiceAI, la plateforme d'appels IA pour l'Afrique.
Tu appelles ${displayName} de l'entreprise "${orgName}" qui vient de créer son compte et teste la plateforme.

Déroulé de l'appel :
1. Félicite-le chaleureusement : son compte AfrivoiceAI fonctionne, c'est l'IA qui parle en ce moment même.
2. Explique en deux phrases ce que la plateforme sait faire : prospection téléphonique B2B automatisée et confirmation des commandes e-commerce en paiement à la livraison.
3. Fais une mini démonstration : pose-lui UNE question de qualification, par exemple "quel type de clients aimeriez-vous contacter ?" et rebondis brièvement sur sa réponse.
4. Conclus : il peut maintenant importer ses leads ou connecter sa boutique depuis le dashboard. Souhaite-lui une excellente journée et termine l'appel.

Règles :
- Parle uniquement en français, ton chaleureux et professionnel.
- Appel court : 60 à 90 secondes maximum.
- Termine avec l'outil endCall dès que la démonstration est faite.`;

  try {
    const vapi = getVapiClient();
    const callResponse = await vapi.calls.create({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: { number: phone, name: params.name?.trim() || undefined },
      assistant: buildAssistantConfig({
        systemPrompt,
        firstMessage: `Bonjour ${displayName} ! Ici Amina, la voix d'AfrivoiceAI. Bonne nouvelle : votre plateforme d'appels est opérationnelle. Vous m'entendez bien ?`,
        endCallMessage:
          "Merci et à très vite sur AfrivoiceAI. Excellente journée !",
        maxTokens: 250,
      }),
    });
    const vapiCallId = getCreatedCallId(callResponse);

    await db.insert(calls).values({
      organizationId: params.organizationId,
      vapiCallId,
      type: "test",
      status: "queued",
    });

    console.log(`[calls/test] Appel de test lancé: ${vapiCallId} → ${phone}`);
    return { ok: true, vapiCallId };
  } catch (vapiError) {
    console.error("[calls/test] Erreur Vapi:", vapiError);
    return {
      ok: false,
      status: 503,
      error:
        "Impossible de lancer l'appel de test. Vérifiez la configuration Vapi (clé API et numéro).",
    };
  }
}

/**
 * Charge un lead et sa campagne (scopés organisation) puis lance l'appel.
 */
export async function initiateLeadCallById(
  leadId: string,
  campaignId: string,
  organizationId: string
): Promise<InitiateCallResult> {
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
    return { ok: false, status: 404, error: "Lead ou campagne introuvable" };
  }

  return initiateLeadCall({ lead, campaign });
}
