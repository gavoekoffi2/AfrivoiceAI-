import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaigns, leads, calls, wallets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { getVapiClient, generateProspectingPrompt } from "@/lib/vapi/client";
import { normalizePhoneNumber } from "@/lib/utils";
import type { Vapi } from "@vapi-ai/server-sdk";
import { buildProspectingFirstMessage } from "@/lib/prospecting";

const BATCH_DELAY_MS = 2000; // 2 secondes entre chaque appel

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const campaignId = params.id;

    // Vérifier la campagne
    const campaignResult = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.organizationId, session.organizationId)
        )
      )
      .limit(1);

    if (!campaignResult[0]) {
      return NextResponse.json(
        { error: "Campagne introuvable" },
        { status: 404 }
      );
    }

    const campaign = campaignResult[0];

    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: "La campagne doit être active pour lancer des appels." },
        { status: 400 }
      );
    }

    // Vérifier le solde
    const walletResult = await db
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, session.organizationId))
      .limit(1);

    if (
      !walletResult[0] ||
      !hasSufficientBalance(walletResult[0].balanceFcfa)
    ) {
      return NextResponse.json(
        { error: "Solde insuffisant pour lancer des appels." },
        { status: 402 }
      );
    }

    // Récupérer les leads en attente
    const pendingLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.campaignId, campaignId),
          eq(leads.status, "new")
        )
      )
      .limit(10); // Limite à 10 appels par batch

    if (pendingLeads.length === 0) {
      return NextResponse.json({
        launched: 0,
        message: "Aucun lead en attente.",
      });
    }

    const vapi = getVapiClient();
    let launched = 0;
    const errors: string[] = [];

    for (const lead of pendingLeads) {
      try {
        // Vérifier le solde avant chaque appel
        const freshWallet = await db
          .select({ balance: wallets.balanceFcfa })
          .from(wallets)
          .where(eq(wallets.organizationId, session.organizationId))
          .limit(1);

        if (!freshWallet[0] || !hasSufficientBalance(freshWallet[0].balance)) {
          console.log("[batch/launch] Solde insuffisant, arrêt du batch");
          break;
        }

        const phone = normalizePhoneNumber(lead.phone, "TG") ?? lead.phone;
        const systemPrompt = generateProspectingPrompt({
          objective: campaign.objective,
          scriptTemplate: campaign.scriptTemplate,
          leadName: lead.name ?? undefined,
          companyName: lead.company ?? undefined,
        });

        const callResponse = await vapi.calls.create({
          phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
          customer: {
            number: phone,
            name: lead.name ?? undefined,
          },
          assistant: {
            model: {
              provider: "google",
              model: "gemini-1.5-flash",
              messages: [{ role: "system", content: systemPrompt }],
              tools: [{ type: "endCall" }],
              maxTokens: 300,
              temperature: 0.7,
            },
            voice: {
              provider: "11labs",
              voiceId: process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL",
            },
            firstMessage: buildProspectingFirstMessage({
              leadName: lead.name,
              companyName: lead.company,
            }),
            endCallMessage: "Merci pour votre temps. Je vous souhaite une excellente journée.",
            artifactPlan: { recordingEnabled: true },
          },
        });
        const vapiCallId = getCreatedCallId(callResponse);

        // Enregistrer l'appel et mettre à jour le lead
        await db.transaction(async (tx) => {
          await tx.insert(calls).values({
            organizationId: session.organizationId,
            vapiCallId,
            leadId: lead.id,
            type: "prospecting",
            status: "queued",
          });

          await tx
            .update(leads)
            .set({ status: "called" })
            .where(eq(leads.id, lead.id));
        });

        launched++;
        console.log(`[batch/launch] Appel lancé: ${vapiCallId} → ${phone}`);

        // Délai entre les appels pour éviter les rate limits
        if (launched < pendingLeads.length) {
          await sleep(BATCH_DELAY_MS);
        }
      } catch (err) {
        console.error(`[batch/launch] Erreur pour lead ${lead.id}:`, err);
        errors.push(lead.id);
      }
    }

    // Mettre à jour les compteurs de la campagne
    await db
      .update(campaigns)
      .set({ calledLeads: campaign.calledLeads + launched })
      .where(eq(campaigns.id, campaignId));

    return NextResponse.json({
      launched,
      errors: errors.length,
      message: `${launched} appel(s) lancé(s) avec succès.`,
    });
  } catch (error) {
    console.error("[batch/launch] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
