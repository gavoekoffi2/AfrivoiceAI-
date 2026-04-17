import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calls,
  orders,
  leads,
  wallets,
  transactions,
  notifications,
} from "@/lib/db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { verifyVapiWebhook } from "@/lib/vapi/verify";
import { calculateClientCostFcfa, isLowBalance } from "@/lib/utils/billing";
import { markWebhookProcessed } from "@/lib/idempotency";
import { logger } from "@/lib/logger";

type Outcome =
  | "confirmed"
  | "cancelled"
  | "no_answer"
  | "qualified"
  | "not_interested"
  | "unclear";

type Sentiment = "positive" | "neutral" | "negative";

interface VapiAnalysis {
  summary?: string;
  successEvaluation?: string | boolean | number;
  structuredData?: {
    outcome?: string;
    sentiment?: string;
    [k: string]: unknown;
  };
}

interface VapiEndOfCallReport {
  message: {
    type: "end-of-call-report";
    call: {
      id: string;
      status: string;
      cost?: number;
      duration?: number;
      endedReason?: string;
    };
    recordingUrl?: string;
    transcript?: string;
    summary?: string;
    analysis?: VapiAnalysis;
  };
}

interface VapiStatusUpdate {
  message: {
    type: "status-update";
    call: {
      id: string;
      status: string;
    };
  };
}

type VapiWebhookPayload = VapiEndOfCallReport | VapiStatusUpdate;

const ENDED_REASON_NO_ANSWER = new Set([
  "customer-did-not-answer",
  "customer-busy",
  "voicemail",
  "no-answer",
  "pipeline-error-twilio-failed-to-connect-call",
]);

/**
 * Classifie l'issue d'un appel. Stratégie :
 * 1. Signal fort de Vapi (endedReason) → pas de réponse.
 * 2. Analyse structurée de Vapi (si configurée côté assistant).
 * 3. successEvaluation booléen de Vapi.
 * 4. Fallback → "unclear" (JAMAIS "confirmed" par défaut : évite les faux positifs
 *    qui polluent le CRM et déclenchent la facturation à tort).
 */
function classifyOutcome(params: {
  type: "ecommerce_confirmation" | "prospecting" | string;
  endedReason?: string | null;
  analysis?: VapiAnalysis;
  durationSeconds: number;
}): { outcome: Outcome; sentiment: Sentiment | null } {
  const reason = (params.endedReason ?? "").toLowerCase();
  if (ENDED_REASON_NO_ANSWER.has(reason) || params.durationSeconds < 5) {
    return { outcome: "no_answer", sentiment: null };
  }

  const structured = params.analysis?.structuredData;
  const structuredOutcome = structured?.outcome?.toLowerCase();
  const structuredSentiment = structured?.sentiment?.toLowerCase() as
    | Sentiment
    | undefined;

  if (structuredOutcome) {
    const allowed: Outcome[] = [
      "confirmed",
      "cancelled",
      "no_answer",
      "qualified",
      "not_interested",
      "unclear",
    ];
    if (allowed.includes(structuredOutcome as Outcome)) {
      return {
        outcome: structuredOutcome as Outcome,
        sentiment:
          structuredSentiment &&
          ["positive", "neutral", "negative"].includes(structuredSentiment)
            ? structuredSentiment
            : null,
      };
    }
  }

  const success = params.analysis?.successEvaluation;
  const successBool =
    success === true ||
    success === "true" ||
    success === 1 ||
    success === "pass";
  const failBool =
    success === false ||
    success === "false" ||
    success === 0 ||
    success === "fail";

  if (params.type === "ecommerce_confirmation") {
    if (successBool) return { outcome: "confirmed", sentiment: "positive" };
    if (failBool) return { outcome: "cancelled", sentiment: "negative" };
  }
  if (params.type === "prospecting") {
    if (successBool) return { outcome: "qualified", sentiment: "positive" };
    if (failBool) return { outcome: "not_interested", sentiment: "negative" };
  }

  return { outcome: "unclear", sentiment: null };
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-vapi-signature");

    if (!verifyVapiWebhook(rawBody, signature)) {
      logger.warn("vapi/webhook", "Signature invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    const payload: VapiWebhookPayload = JSON.parse(rawBody);
    const { type } = payload.message;

    if (type === "status-update") {
      const { call } = (payload as VapiStatusUpdate).message;
      await db
        .update(calls)
        .set({ status: call.status })
        .where(eq(calls.vapiCallId, call.id));
      return NextResponse.json({ received: true });
    }

    if (type !== "end-of-call-report") {
      return NextResponse.json({ received: true });
    }

    const { call, recordingUrl, transcript, summary, analysis } = (
      payload as VapiEndOfCallReport
    ).message;

    const callResult = await db
      .select()
      .from(calls)
      .where(eq(calls.vapiCallId, call.id))
      .limit(1);

    const dbCall = callResult[0];
    if (!dbCall) {
      logger.error("vapi/webhook", "Appel introuvable", { vapiCallId: call.id });
      return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
    }

    // Idempotence : même rapport livré deux fois → on ne refacture pas.
    const isNew = await markWebhookProcessed({
      provider: "vapi",
      externalId: `end_of_call_${call.id}`,
      organizationId: dbCall.organizationId,
      payload,
    });
    if (!isNew || dbCall.billed) {
      return NextResponse.json({
        received: true,
        action: "duplicate_ignored",
      });
    }

    const costUsd = call.cost ?? 0;
    const costFcfa = calculateClientCostFcfa(costUsd);
    const durationSeconds = call.duration ?? 0;

    const { outcome, sentiment } = classifyOutcome({
      type: dbCall.type,
      endedReason: call.endedReason,
      analysis,
      durationSeconds,
    });

    let lowBalanceWarning = false;

    await db.transaction(async (tx) => {
      await tx
        .update(calls)
        .set({
          status: call.status === "ended" ? "completed" : call.status,
          durationSeconds,
          costUsd: costUsd.toString(),
          costFcfa: costFcfa.toString(),
          recordingUrl: recordingUrl ?? null,
          transcript: transcript ?? null,
          summary: summary ?? analysis?.summary ?? null,
          endedReason: call.endedReason ?? null,
          outcome,
          sentiment,
          billed: costFcfa > 0,
        })
        .where(eq(calls.id, dbCall.id));

      if (costFcfa > 0) {
        // Verrouille la ligne wallet avant débit pour éviter les races.
        type LockedWallet = {
          id: string;
          balance_fcfa: string;
          low_balance_alert_sent: boolean;
        };
        const walletRows = await tx.execute(
          sql`SELECT id, balance_fcfa, low_balance_alert_sent FROM wallets WHERE organization_id = ${dbCall.organizationId} FOR UPDATE`
        );
        const walletRow = Array.isArray(walletRows)
          ? (walletRows as unknown as LockedWallet[])[0]
          : ((walletRows as unknown as { rows?: LockedWallet[] }).rows?.[0]);

        if (walletRow) {
          await tx.insert(transactions).values({
            walletId: walletRow.id,
            type: "call_cost",
            amountFcfa: (-costFcfa).toString(),
            status: "completed",
            description: `Appel ${
              dbCall.type === "ecommerce_confirmation"
                ? "confirmation commande"
                : "prospection"
            } (${durationSeconds}s)`,
            metadata: {
              vapiCallId: call.id,
              costUsd,
              durationSeconds,
              outcome,
            },
          });

          await tx
            .update(wallets)
            .set({
              balanceFcfa: sql`GREATEST(${wallets.balanceFcfa} - ${costFcfa}, 0)`,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, walletRow.id));

          const newBalance = parseFloat(walletRow.balance_fcfa) - costFcfa;
          if (isLowBalance(newBalance) && !walletRow.low_balance_alert_sent) {
            await tx
              .update(wallets)
              .set({ lowBalanceAlertSent: true })
              .where(eq(wallets.id, walletRow.id));
            lowBalanceWarning = true;
          }
        }
      }

      if (dbCall.orderId && outcome !== "unclear") {
        const orderStatusMap: Record<string, string> = {
          confirmed: "confirmed",
          cancelled: "cancelled",
          no_answer: "no_answer",
        };
        const newStatus = orderStatusMap[outcome];
        // Transitions autorisées uniquement depuis un état "calling" ou "pending".
        const allowedFromStatuses = ["calling", "pending"];
        if (newStatus) {
          await tx
            .update(orders)
            .set({ status: newStatus })
            .where(
              and(
                eq(orders.id, dbCall.orderId),
                inArray(orders.status, allowedFromStatuses)
              )
            );
        }
      }

      if (dbCall.leadId) {
        const leadStatusMap: Record<string, string> = {
          qualified: "qualified",
          not_interested: "not_interested",
          no_answer: "no_answer",
          unclear: "needs_review",
        };
        const leadStatus = leadStatusMap[outcome] ?? "needs_review";
        await tx
          .update(leads)
          .set({
            status: leadStatus,
            notes: summary ?? analysis?.summary ?? null,
          })
          .where(eq(leads.id, dbCall.leadId));
      }

      await tx.insert(notifications).values({
        organizationId: dbCall.organizationId,
        type: "call_completed",
        title: `Appel terminé — ${outcome}`,
        body: `Durée : ${durationSeconds}s · Coût : ${costFcfa} FCFA`,
        link:
          dbCall.type === "ecommerce_confirmation"
            ? "/dashboard/e-commerce"
            : "/dashboard/prospection",
      });

      if (lowBalanceWarning) {
        await tx.insert(notifications).values({
          organizationId: dbCall.organizationId,
          type: "low_balance",
          title: "Solde bas",
          body: "Votre solde est proche de l'épuisement. Rechargez pour continuer les appels.",
          link: "/dashboard/wallet",
        });
      }
    });

    logger.info("vapi/webhook", "Appel terminé", {
      vapiCallId: call.id,
      durationSeconds,
      costFcfa,
      outcome,
    });

    return NextResponse.json({
      received: true,
      processed: true,
      outcome,
    });
  } catch (error) {
    logger.error("vapi/webhook", "Erreur serveur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
