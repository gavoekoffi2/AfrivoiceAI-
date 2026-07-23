import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, calls, wallets, campaigns, leads, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getVapiClient,
  generateEcommercePrompt,
  generateProspectingPrompt,
  getFrenchElevenLabsVoice,
  getAgentVoice,
  getFirstMessageForLanguage,
  getVapiWebhookServer,
} from "@/lib/vapi/client";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { getUserSession } from "@/lib/auth";
import { normalizePhoneNumber } from "@/lib/utils";
import type { Vapi } from "@vapi-ai/server-sdk";
import { buildProspectingFirstMessage } from "@/lib/prospecting";
import { getOutboundPhoneNumberId } from "@/lib/vapi/routing";

type AgentVoiceLanguage = "fr" | "ewe";

function getCampaignVoiceLanguage(value: string | null | undefined): AgentVoiceLanguage {
  return value === "ewe" ? "ewe" : "fr";
}

function getCreatedCallId(callResponse: Vapi.CallsCreateResponse): string {
  if ("id" in callResponse) {
    return callResponse.id;
  }

  const firstCreatedCall = callResponse.results[0];
  if (!firstCreatedCall) {
    throw new Error("Vapi n'a retourné aucun appel créé");
  }

  return firstCreatedCall.id;
}

function summarizeCallStartError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 600);
  }

  if (typeof error === "string") {
    return error.slice(0, 600);
  }

  try {
    return JSON.stringify(error).slice(0, 600);
  } catch {
    return "Erreur inconnue au lancement de l'appel";
  }
}

function createLocalFailedCallId(): string {
  return `local_failed_${randomUUID()}`;
}

export async function POST(req: Request) {
  try {
    // Vérifier l'authentification (via session OU appel interne)
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternalCall =
      internalSecret === process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (isInternalCall) {
      // Appel depuis le webhook Shopify — récupérer l'org depuis la commande
      const body = await req.json();
      const { orderId } = body;

      const orderResult = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!orderResult[0]) {
        return NextResponse.json(
          { error: "Commande introuvable" },
          { status: 404 }
        );
      }

      return await initiateEcommerceCall(
        orderResult[0],
        orderResult[0].organizationId
      );
    }

    // Appel authentifié depuis le dashboard
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();

    if (body.orderId) {
      const orderResult = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, body.orderId),
            eq(orders.organizationId, session.organizationId)
          )
        )
        .limit(1);

      if (!orderResult[0]) {
        return NextResponse.json(
          { error: "Commande introuvable" },
          { status: 404 }
        );
      }

      return await initiateEcommerceCall(orderResult[0], session.organizationId);
    }

    if (body.leadId && body.campaignId) {
      return await initiateProspectingCall(
        body.leadId,
        body.campaignId,
        session.organizationId
      );
    }

    return NextResponse.json(
      {
        error:
          "Paramètres invalides : orderId ou (leadId + campaignId) requis",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[calls/initiate] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

async function initiateEcommerceCall(
  order: typeof orders.$inferSelect,
  organizationId: string
) {
  // 1. Vérifier le solde du wallet
  const walletResult = await db
    .select()
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);

  const wallet = walletResult[0];
  if (!wallet || !hasSufficientBalance(wallet.balanceFcfa)) {
    return NextResponse.json(
      { error: "Solde insuffisant. Rechargez votre wallet." },
      { status: 402 }
    );
  }

  // 2. Récupérer le nom de la boutique
  const orgResult = await db
    .select({ shopName: organizations.shopName, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const shopName =
    orgResult[0]?.shopName ?? orgResult[0]?.name ?? "Notre Boutique";

  // 3. Générer le prompt système
  const systemPrompt = generateEcommercePrompt({
    customerName: order.customerName,
    shopName,
    orderAmount: order.totalAmount ?? "N/A",
    currency: order.currency,
    address: order.customerAddress ?? "adresse non précisée",
    orderId: order.externalId,
  });

  try {
    const vapi = getVapiClient();
    const customerPhone =
      normalizePhoneNumber(order.customerPhone, "TG") ?? order.customerPhone;

    // 4. Lancer l'appel via le transport adapté à la destination.
    const callResponse = await vapi.calls.create({
      phoneNumberId: getOutboundPhoneNumberId(customerPhone),
      customer: {
        number: customerPhone,
        name: order.customerName,
      },
      assistant: {
        server: getVapiWebhookServer(),
        model: {
          provider: "google",
          model: "gemini-1.5-flash",
          messages: [{ role: "system", content: systemPrompt }],
          tools: [{ type: "endCall" }],
          maxTokens: 250,
          temperature: 0.7,
        },
        voice: getFrenchElevenLabsVoice(),
        firstMessage: `Bonjour ${order.customerName}, c'est Amina de la boutique ${shopName}. Je vous appelle pour confirmer votre commande. Avez-vous quelques instants ?`,
        endCallMessage: "Merci beaucoup. Je vous souhaite une excellente journée.",
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
      },
    });
    const vapiCallId = getCreatedCallId(callResponse);

    // 5. Enregistrer l'appel + mettre à jour le statut de la commande
    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
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

    return NextResponse.json({
      success: true,
      callId: vapiCallId,
      vapiCallId,
    });
  } catch (vapiError) {
    console.error("[calls/initiate] Erreur Vapi:", vapiError);
    const errorSummary = summarizeCallStartError(vapiError);

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId: createLocalFailedCallId(),
        orderId: order.id,
        type: "ecommerce_confirmation",
        status: "failed",
        summary: `Échec lancement Vapi : ${errorSummary}`,
        endedReason: "vapi_create_failed",
      });

      await tx
        .update(orders)
        .set({ status: "pending" })
        .where(eq(orders.id, order.id));
    });

    return NextResponse.json(
      {
        error: "Impossible de lancer l'appel via Vapi",
        details:
          "L'échec a été enregistré dans l'historique des appels avec le statut failed.",
      },
      { status: 503 }
    );
  }
}

async function initiateProspectingCall(
  leadId: string,
  campaignId: string,
  organizationId: string
) {
  // Vérifier le solde
  const walletResult = await db
    .select()
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);

  if (
    !walletResult[0] ||
    !hasSufficientBalance(walletResult[0].balanceFcfa)
  ) {
    return NextResponse.json({ error: "Solde insuffisant." }, { status: 402 });
  }

  // Récupérer le lead et la campagne
  const [leadResult, campaignResult] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(
        and(eq(leads.id, leadId), eq(leads.organizationId, organizationId))
      )
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
    return NextResponse.json(
      { error: "Lead ou campagne introuvable" },
      { status: 404 }
    );
  }

  const phone = normalizePhoneNumber(lead.phone, "TG") ?? lead.phone;
  const voiceLanguage = getCampaignVoiceLanguage(campaign.voiceLanguage);

  const systemPrompt = generateProspectingPrompt({
    objective: campaign.objective,
    scriptTemplate: campaign.scriptTemplate,
    leadName: lead.name ?? undefined,
    companyName: lead.company ?? undefined,
    voiceLanguage,
  });

  try {
    const vapi = getVapiClient();

    const callResponse = await vapi.calls.create({
      phoneNumberId: getOutboundPhoneNumberId(phone),
      customer: {
        number: phone,
        name: lead.name ?? undefined,
      },
      assistant: {
        server: getVapiWebhookServer(),
        model: {
          provider: "google",
          model: "gemini-1.5-flash",
          messages: [{ role: "system", content: systemPrompt }],
          tools: [{ type: "endCall" }],
          maxTokens: 300,
          temperature: 0.7,
        },
        voice: getAgentVoice(voiceLanguage),
        firstMessage: getFirstMessageForLanguage(
          voiceLanguage,
          buildProspectingFirstMessage({
            leadName: lead.name,
            companyName: lead.company,
          })
        ),
        endCallMessage:
          voiceLanguage === "ewe"
            ? "Akpe na wò. Ne èdi la, míate ŋu ayi edzi le français me."
            : "Merci pour votre temps. Je vous souhaite une excellente journée.",
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
      },
    });
    const vapiCallId = getCreatedCallId(callResponse);

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId,
        leadId,
        type: "prospecting",
        status: "queued",
      });

      await tx
        .update(leads)
        .set({ status: "called" })
        .where(eq(leads.id, leadId));
    });

    return NextResponse.json({ success: true, callId: vapiCallId });
  } catch (vapiError) {
    console.error("[calls/initiate/prospecting] Erreur Vapi:", vapiError);
    const errorSummary = summarizeCallStartError(vapiError);

    await db.transaction(async (tx) => {
      await tx.insert(calls).values({
        organizationId,
        vapiCallId: createLocalFailedCallId(),
        leadId,
        type: "prospecting",
        status: "failed",
        summary: `Échec lancement Vapi : ${errorSummary}`,
        endedReason: "vapi_create_failed",
      });

      await tx
        .update(leads)
        .set({
          status: "new",
          notes: `Dernière tentative échouée : ${errorSummary}`,
        })
        .where(eq(leads.id, leadId));
    });

    return NextResponse.json(
      {
        error: "Impossible de lancer l'appel Vapi",
        details:
          "L'échec a été enregistré dans l'historique des appels avec le statut failed.",
      },
      { status: 503 }
    );
  }
}
