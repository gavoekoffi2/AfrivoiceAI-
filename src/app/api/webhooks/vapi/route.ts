import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, orders, leads, wallets, transactions } from "@/lib/db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { verifyVapiWebhook } from "@/lib/vapi/verify";
import { calculateClientCostFcfa } from "@/lib/utils/billing";
import {
  resolveOrderOutcome,
  resolveLeadQualified,
} from "@/lib/calls/outcome";

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
    analysis?: {
      structuredData?: unknown;
      summary?: string;
    };
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

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-vapi-signature");

    if (!verifyVapiWebhook(rawBody, signature)) {
      console.warn("[vapi/webhook] Signature invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    let payload: VapiWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const { type } = payload.message;

    // Mise à jour du statut en temps réel (ne jamais écraser un appel finalisé).
    if (type === "status-update") {
      const { call } = (payload as VapiStatusUpdate).message;
      await db
        .update(calls)
        .set({ status: call.status })
        .where(
          and(eq(calls.vapiCallId, call.id), ne(calls.status, "completed"))
        );

      return NextResponse.json({ received: true });
    }

    // Rapport de fin d'appel
    if (type === "end-of-call-report") {
      const { call, recordingUrl, transcript, summary, analysis } = (
        payload as VapiEndOfCallReport
      ).message;
      const structuredData = analysis?.structuredData;

      const callResult = await db
        .select()
        .from(calls)
        .where(eq(calls.vapiCallId, call.id))
        .limit(1);

      const dbCall = callResult[0];
      if (!dbCall) {
        console.error(`[vapi/webhook] Appel introuvable: ${call.id}`);
        return NextResponse.json(
          { error: "Appel introuvable" },
          { status: 404 }
        );
      }

      const costUsd = call.cost ?? 0;
      const costFcfa = calculateClientCostFcfa(costUsd);
      const durationSeconds = call.duration ?? 0;

      // Issue déterministe (structured data Vapi) avec repli heuristique.
      const orderOutcome = dbCall.orderId
        ? resolveOrderOutcome({ structuredData, summary, transcript })
        : null;

      let alreadyProcessed = false;

      await db.transaction(async (tx) => {
        // Finalisation idempotente : seul le premier rapport bascule l'appel en
        // "completed". Les rappels Vapi (retries) ne re-déduisent donc pas.
        const finalized = await tx
          .update(calls)
          .set({
            status: "completed",
            durationSeconds,
            costUsd: costUsd.toString(),
            costFcfa: costFcfa.toString(),
            recordingUrl: recordingUrl ?? null,
            transcript: transcript ?? null,
            summary: summary ?? null,
            endedReason: call.endedReason ?? null,
          })
          .where(and(eq(calls.id, dbCall.id), ne(calls.status, "completed")))
          .returning({ id: calls.id });

        if (finalized.length === 0) {
          alreadyProcessed = true;
          return;
        }

        // Déduire le coût du wallet (atomique).
        if (costFcfa > 0) {
          const walletResult = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.organizationId, dbCall.organizationId))
            .limit(1);
          const wallet = walletResult[0];

          if (wallet) {
            await tx.insert(transactions).values({
              walletId: wallet.id,
              type: "call_cost",
              amountFcfa: (-costFcfa).toString(),
              description: `Appel ${
                dbCall.type === "ecommerce_confirmation"
                  ? "confirmation commande"
                  : "prospection"
              } (${durationSeconds}s)`,
              metadata: { vapiCallId: call.id, costUsd, durationSeconds },
            });

            await tx
              .update(wallets)
              .set({
                balanceFcfa: sql`${wallets.balanceFcfa} - ${costFcfa}`,
                updatedAt: new Date(),
              })
              .where(eq(wallets.id, wallet.id));
          }
        }

        // Statut de la commande associée.
        if (dbCall.orderId && orderOutcome) {
          await tx
            .update(orders)
            .set({ status: orderOutcome })
            .where(eq(orders.id, dbCall.orderId));
        }

        // Statut du lead associé.
        if (dbCall.leadId) {
          const leadStatus = resolveLeadQualified({ structuredData, summary })
            ? "qualified"
            : "not_interested";

          await tx
            .update(leads)
            .set({ status: leadStatus, notes: summary ?? null })
            .where(eq(leads.id, dbCall.leadId));
        }
      });

      if (alreadyProcessed) {
        console.log(`[vapi/webhook] Rapport déjà traité (ignoré): ${call.id}`);
        return NextResponse.json({ received: true, duplicate: true });
      }

      console.log(
        `[vapi/webhook] Appel terminé: ${call.id} | Durée: ${durationSeconds}s | Coût: ${costFcfa} FCFA | Issue commande: ${orderOutcome ?? "N/A"}`
      );

      return NextResponse.json({ received: true, processed: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[vapi/webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
