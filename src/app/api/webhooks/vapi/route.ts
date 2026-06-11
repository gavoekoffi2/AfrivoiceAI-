import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calls,
  orders,
  leads,
  wallets,
  transactions,
  campaigns,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyVapiWebhook } from "@/lib/vapi/verify";
import { calculateClientCostFcfa } from "@/lib/utils/billing";
import { classifyProspectingOutcome } from "@/lib/prospecting";
import { analyzeOrderOutcome, mapEndedReasonToCallStatus } from "@/lib/orders";

/**
 * Payload Vapi (forme défensive) : selon les versions, certains champs
 * arrivent au niveau `message` (format actuel documenté) ou au niveau
 * `message.call` (anciens exemples). On lit les deux.
 */
interface VapiWebhookMessage {
  type: string;
  status?: string;
  endedReason?: string;
  cost?: number;
  durationSeconds?: number;
  durationMs?: number;
  startedAt?: string;
  endedAt?: string;
  recordingUrl?: string;
  transcript?: string;
  summary?: string;
  analysis?: {
    summary?: string;
    successEvaluation?: string;
  };
  artifact?: {
    recordingUrl?: string;
    transcript?: string;
  };
  call?: {
    id?: string;
    status?: string;
    cost?: number;
    duration?: number;
    endedReason?: string;
  };
}

const TERMINAL_CALL_STATUSES = new Set(["completed", "failed", "no-answer"]);

function extractDurationSeconds(message: VapiWebhookMessage): number {
  if (typeof message.durationSeconds === "number") {
    return Math.round(message.durationSeconds);
  }
  if (typeof message.durationMs === "number") {
    return Math.round(message.durationMs / 1000);
  }
  if (message.startedAt && message.endedAt) {
    const diffMs =
      new Date(message.endedAt).getTime() -
      new Date(message.startedAt).getTime();
    if (Number.isFinite(diffMs) && diffMs > 0) return Math.round(diffMs / 1000);
  }
  if (typeof message.call?.duration === "number") {
    return Math.round(message.call.duration);
  }
  return 0;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    if (
      !verifyVapiWebhook(rawBody, {
        secret: req.headers.get("x-vapi-secret"),
        signature: req.headers.get("x-vapi-signature"),
      })
    ) {
      console.warn("[vapi/webhook] Authentification du webhook invalide");
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    let payload: { message?: VapiWebhookMessage };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
    }

    const message = payload.message;
    if (!message?.type) {
      return NextResponse.json({ received: true });
    }

    const vapiCallId = message.call?.id;
    if (!vapiCallId) {
      return NextResponse.json({ received: true, skipped: "no_call_id" });
    }

    // Mise à jour du statut en temps réel
    if (message.type === "status-update") {
      const incomingStatus = message.status ?? message.call?.status;
      if (incomingStatus) {
        const status =
          incomingStatus === "ended" ? "completed" : incomingStatus;
        await db
          .update(calls)
          .set({ status })
          .where(eq(calls.vapiCallId, vapiCallId));
      }
      return NextResponse.json({ received: true });
    }

    // Rapport de fin d'appel
    if (message.type === "end-of-call-report") {
      const callResult = await db
        .select()
        .from(calls)
        .where(eq(calls.vapiCallId, vapiCallId))
        .limit(1);

      const dbCall = callResult[0];
      if (!dbCall) {
        console.error(`[vapi/webhook] Appel introuvable: ${vapiCallId}`);
        return NextResponse.json(
          { error: "Appel introuvable" },
          { status: 404 }
        );
      }

      // Idempotence : Vapi peut relivrer le rapport — ne jamais débiter deux fois
      if (
        TERMINAL_CALL_STATUSES.has(dbCall.status) &&
        dbCall.costFcfa !== null
      ) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      const endedReason =
        message.endedReason ?? message.call?.endedReason ?? null;
      const costUsd = message.cost ?? message.call?.cost ?? 0;
      const costFcfa = calculateClientCostFcfa(costUsd);
      const durationSeconds = extractDurationSeconds(message);
      const recordingUrl =
        message.artifact?.recordingUrl ?? message.recordingUrl ?? null;
      const transcript =
        message.artifact?.transcript ?? message.transcript ?? null;
      const summary = message.analysis?.summary ?? message.summary ?? null;
      const finalStatus = mapEndedReasonToCallStatus(endedReason);

      // Récupérer le wallet
      const walletResult = await db
        .select()
        .from(wallets)
        .where(eq(wallets.organizationId, dbCall.organizationId))
        .limit(1);
      const wallet = walletResult[0];

      // Analyser l'issue de la commande
      const orderOutcome = dbCall.orderId
        ? analyzeOrderOutcome({ summary, transcript, endedReason })
        : null;

      // Transaction atomique : appel + wallet + commande/lead
      await db.transaction(async (tx) => {
        await tx
          .update(calls)
          .set({
            status: finalStatus,
            durationSeconds,
            costUsd: costUsd.toString(),
            costFcfa: costFcfa.toString(),
            recordingUrl,
            transcript,
            summary,
            endedReason,
          })
          .where(eq(calls.id, dbCall.id));

        if (wallet && costFcfa > 0) {
          await tx.insert(transactions).values({
            walletId: wallet.id,
            type: "call_cost",
            amountFcfa: (-costFcfa).toString(),
            description: `Appel ${dbCall.type === "ecommerce_confirmation" ? "confirmation commande" : "prospection"} (${durationSeconds}s)`,
            metadata: {
              vapiCallId,
              costUsd,
              durationSeconds,
            },
          });

          await tx
            .update(wallets)
            .set({
              balanceFcfa: sql`${wallets.balanceFcfa} - ${costFcfa}`,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, wallet.id));
        }

        if (dbCall.orderId && orderOutcome) {
          await tx
            .update(orders)
            .set({ status: orderOutcome })
            .where(eq(orders.id, dbCall.orderId));
        }

        if (dbCall.leadId) {
          const leadStatus = classifyProspectingOutcome({
            summary,
            transcript,
            endedReason,
          });

          const [updatedLead] = await tx
            .update(leads)
            .set({ status: leadStatus, notes: summary ?? null })
            .where(eq(leads.id, dbCall.leadId))
            .returning({ campaignId: leads.campaignId });

          if (leadStatus === "qualified" && updatedLead) {
            await tx
              .update(campaigns)
              .set({ qualifiedLeads: sql`${campaigns.qualifiedLeads} + 1` })
              .where(eq(campaigns.id, updatedLead.campaignId));
          }
        }
      });

      console.log(
        `[vapi/webhook] Appel terminé: ${vapiCallId} | Statut: ${finalStatus} | Durée: ${durationSeconds}s | Coût: ${costFcfa} FCFA | Issue commande: ${orderOutcome ?? "N/A"}`
      );

      return NextResponse.json({ received: true, processed: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[vapi/webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
