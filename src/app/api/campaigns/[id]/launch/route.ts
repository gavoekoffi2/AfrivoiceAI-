import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  campaigns,
  leads,
  calls,
  wallets,
  phoneLines,
  organizationBillingProfiles,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hasCallAllowance } from "@/lib/utils/billing";
import { getBillingPlan } from "@/lib/billing/plans";
import { getFrenchElevenLabsVoice, getVapiClient, generateProspectingPrompt } from "@/lib/vapi/client";
import { normalizePhoneNumber } from "@/lib/utils";
import type { Vapi } from "@vapi-ai/server-sdk";
import { buildProspectingFirstMessage } from "@/lib/prospecting";
import { resolvePhoneLineVapiId } from "@/lib/vapi/routing";
import { randomUUID } from "crypto";

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

function summarizeCallStartError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 600);
  if (typeof error === "string") return error.slice(0, 600);
  try {
    return JSON.stringify(error).slice(0, 600);
  } catch {
    return "Erreur inconnue au lancement de l'appel";
  }
}

function createLocalFailedCallId(): string {
  return `local_failed_${randomUUID()}`;
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

    if (!campaign.phoneLineId) {
      return NextResponse.json(
        { error: "Choisissez une ligne téléphonique pour cette campagne." },
        { status: 400 }
      );
    }

    const selectedLine = await db.query.phoneLines.findFirst({
      where: and(
        eq(phoneLines.id, campaign.phoneLineId),
        eq(phoneLines.organizationId, session.organizationId),
        eq(phoneLines.status, "active"),
        eq(phoneLines.verificationStatus, "verified")
      ),
    });

    if (!selectedLine) {
      return NextResponse.json(
        { error: "La ligne choisie n’est plus active ou vérifiée." },
        { status: 400 }
      );
    }

    // Vérifier les minutes du forfait, les bonus ou le wallet.
    const [walletResult, billingProfile] = await Promise.all([
      db
        .select()
        .from(wallets)
        .where(eq(wallets.organizationId, session.organizationId))
        .limit(1),
      db.query.organizationBillingProfiles.findFirst({
        where: eq(
          organizationBillingProfiles.organizationId,
          session.organizationId
        ),
      }),
    ]);
    const plan = getBillingPlan(billingProfile?.planCode);

    if (
      !walletResult[0] ||
      !hasCallAllowance({
        balanceFcfa: walletResult[0].balanceFcfa,
        includedMinutesMonthly:
          billingProfile?.includedMinutesMonthly ?? plan.includedMinutes,
        usedMinutesThisCycle: billingProfile?.usedMinutesThisCycle ?? "0",
        bonusMinutesBalance: billingProfile?.bonusMinutesBalance ?? "0",
      })
    ) {
      return NextResponse.json(
        { error: "Minutes épuisées et wallet insuffisant. Ajoutez un pack de minutes." },
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
          eq(leads.organizationId, session.organizationId),
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
    let failed = 0;
    const errors: Array<{ leadId: string; reason: string }> = [];

    for (const lead of pendingLeads) {
      try {
        // Vérifier le solde avant chaque appel
        const freshWallet = await db
          .select({ balance: wallets.balanceFcfa })
          .from(wallets)
          .where(eq(wallets.organizationId, session.organizationId))
          .limit(1);

        if (
          !freshWallet[0] ||
          !hasCallAllowance({
            balanceFcfa: freshWallet[0].balance,
            includedMinutesMonthly:
              billingProfile?.includedMinutesMonthly ?? plan.includedMinutes,
            usedMinutesThisCycle: billingProfile?.usedMinutesThisCycle ?? "0",
            bonusMinutesBalance: billingProfile?.bonusMinutesBalance ?? "0",
          })
        ) {
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
          phoneNumberId: resolvePhoneLineVapiId(selectedLine, phone),
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
            voice: getFrenchElevenLabsVoice(),
            firstMessage: buildProspectingFirstMessage({
              leadName: lead.name,
              companyName: lead.company,
            }),
            endCallMessage: "Merci pour votre temps. Je vous souhaite une excellente journée.",
            artifactPlan: { recordingEnabled: true },
            transcriber: {
              provider: "deepgram",
              model: "nova-2",
              language: "fr",
            },
          },
        });
        const vapiCallId = getCreatedCallId(callResponse);

        // Enregistrer l'appel et mettre à jour le lead
        await db.transaction(async (tx) => {
          await tx.insert(calls).values({
            organizationId: session.organizationId,
            phoneLineId: selectedLine.id,
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
        failed++;
        const reason = summarizeCallStartError(err);
        errors.push({ leadId: lead.id, reason });

        // Rendre l'échec visible dans l'historique et garder le lead relançable.
        await db.transaction(async (tx) => {
          await tx.insert(calls).values({
            organizationId: session.organizationId,
            phoneLineId: selectedLine.id,
            vapiCallId: createLocalFailedCallId(),
            leadId: lead.id,
            type: "prospecting",
            status: "failed",
            summary: `Échec lancement Vapi : ${reason}`,
            endedReason: "vapi_create_failed",
          });

          await tx
            .update(leads)
            .set({
              status: "new",
              notes: `Dernier lancement échoué : ${reason}`,
            })
            .where(eq(leads.id, lead.id));
        });
      }
    }

    // Mettre à jour les compteurs de la campagne
    await db
      .update(campaigns)
      .set({ calledLeads: campaign.calledLeads + launched })
      .where(eq(campaigns.id, campaignId));

    return NextResponse.json({
      launched,
      failed,
      errors,
      message:
        failed > 0
          ? `${launched} appel(s) lancé(s), ${failed} échec(s) enregistrés dans l'historique.`
          : `${launched} appel(s) lancé(s) avec succès.`,
    });
  } catch (error) {
    console.error("[batch/launch] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

