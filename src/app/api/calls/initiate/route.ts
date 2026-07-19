import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, calls, wallets, campaigns, leads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getVapiClient,
  generateProspectingPrompt,
  getAgentVoice,
  getFirstMessageForLanguage,
  getVapiWebhookServer,
} from "@/lib/vapi/client";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { getUserSession } from "@/lib/auth";
import { normalizePhoneNumber } from "@/lib/utils";
import type { Vapi } from "@vapi-ai/server-sdk";
import { buildProspectingFirstMessage } from "@/lib/prospecting";
import {
  startEcommerceConfirmationCall,
  summarizeCallStartError,
  createLocalFailedCallId,
} from "@/lib/calls/initiate-ecommerce";

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

export async function POST(req: Request) {
  try {
    // Appel authentifié depuis le dashboard uniquement.
    // Les webhooks e-commerce lancent leurs appels directement via
    // startEcommerceConfirmationCall (pas d'appel HTTP interne).
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

      const result = await startEcommerceConfirmationCall(
        orderResult[0],
        session.organizationId
      );

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, details: result.details },
          { status: result.status }
        );
      }

      return NextResponse.json({
        success: true,
        callId: result.vapiCallId,
        vapiCallId: result.vapiCallId,
      });
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
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
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
