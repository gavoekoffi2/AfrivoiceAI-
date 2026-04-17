import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  campaigns,
  leads,
  calls,
  wallets,
  organizations,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { getVapiClient, generateProspectingPrompt } from "@/lib/vapi/client";
import { normalizePhoneNumber } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const BATCH_DELAY_MS = 2000;
const BATCH_SIZE = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type WalletLockedRow = { balance_fcfa: string };

function firstRow<T>(executeResult: unknown): T | undefined {
  if (Array.isArray(executeResult)) return executeResult[0] as T | undefined;
  const rows = (executeResult as { rows?: unknown[] })?.rows;
  return rows?.[0] as T | undefined;
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

    const rl = rateLimit(
      `campaigns:launch:${session.organizationId}`,
      5,
      60_000
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: "Trop de lancements simultanés. Réessayez dans une minute." },
        { status: 429 }
      );
    }

    const campaignId = params.id;

    const [campaignResult, orgResult] = await Promise.all([
      db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.id, campaignId),
            eq(campaigns.organizationId, session.organizationId)
          )
        )
        .limit(1),
      db
        .select({ countryCode: organizations.countryCode })
        .from(organizations)
        .where(eq(organizations.id, session.organizationId))
        .limit(1),
    ]);

    if (!campaignResult[0]) {
      return NextResponse.json(
        { error: "Campagne introuvable" },
        { status: 404 }
      );
    }

    const campaign = campaignResult[0];
    const countryCode = orgResult[0]?.countryCode || "TG";

    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: "La campagne doit être active pour lancer des appels." },
        { status: 400 }
      );
    }

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

    const pendingLeads = await db
      .select()
      .from(leads)
      .where(
        and(eq(leads.campaignId, campaignId), eq(leads.status, "new"))
      )
      .limit(BATCH_SIZE);

    if (pendingLeads.length === 0) {
      return NextResponse.json({
        launched: 0,
        message: "Aucun lead en attente.",
      });
    }

    const vapi = getVapiClient();
    let launched = 0;
    let invalidPhones = 0;
    const errors: string[] = [];

    for (const lead of pendingLeads) {
      try {
        const balanceCheck = await db.transaction(async (tx) => {
          const rows = await tx.execute(
            sql`SELECT balance_fcfa FROM wallets WHERE organization_id = ${session.organizationId} FOR UPDATE`
          );
          const row = firstRow<WalletLockedRow>(rows);
          if (!row) return { ok: false as const, reason: "no_wallet" };
          if (!hasSufficientBalance(row.balance_fcfa)) {
            return { ok: false as const, reason: "low_balance" };
          }
          return { ok: true as const };
        });

        if (!balanceCheck.ok) {
          logger.warn("campaigns/launch", "Solde insuffisant, arrêt du batch", {
            campaignId,
            organizationId: session.organizationId,
            reason: balanceCheck.reason,
          });
          break;
        }

        const phone = normalizePhoneNumber(lead.phone, countryCode);
        if (!phone) {
          await db
            .update(leads)
            .set({ status: "invalid_phone" })
            .where(eq(leads.id, lead.id));
          invalidPhones++;
          continue;
        }

        const systemPrompt = generateProspectingPrompt({
          objective: campaign.objective,
          scriptTemplate: campaign.scriptTemplate,
          leadName: lead.name ?? undefined,
          companyName: lead.company ?? undefined,
        });

        const callResponse = (await vapi.calls.create({
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
              maxTokens: 300,
              temperature: 0.7,
            },
            voice: {
              provider: "11labs",
              voiceId:
                process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL",
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
          },
        })) as unknown as { id: string };

        await db.transaction(async (tx) => {
          await tx.insert(calls).values({
            organizationId: session.organizationId,
            vapiCallId: callResponse.id,
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
        logger.info("campaigns/launch", "Appel lancé", {
          vapiCallId: callResponse.id,
          leadId: lead.id,
          campaignId,
        });

        if (launched < pendingLeads.length) {
          await sleep(BATCH_DELAY_MS);
        }
      } catch (err) {
        logger.error("campaigns/launch", "Erreur lead", {
          leadId: lead.id,
          campaignId,
          error: String(err),
        });
        errors.push(lead.id);
      }
    }

    if (launched > 0) {
      await db
        .update(campaigns)
        .set({ calledLeads: campaign.calledLeads + launched })
        .where(eq(campaigns.id, campaignId));
    }

    return NextResponse.json({
      launched,
      errors: errors.length,
      invalidPhones,
      message: `${launched} appel(s) lancé(s) avec succès.`,
    });
  } catch (error) {
    logger.error("campaigns/launch", "Erreur serveur", {
      error: String(error),
    });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
