import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, orders, leads, wallets, transactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyVapiWebhook } from "@/lib/vapi/verify";
import { calculateClientCostFcfa } from "@/lib/utils/billing";

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

/**
 * Analyse le résumé de l'appel pour déterminer le résultat de la commande
 */
function analyzeCallOutcome(
  summary: string,
  transcript: string
): "confirmed" | "cancelled" | "no_answer" {
  const combined = `${summary} ${transcript}`.toLowerCase();

  // Signaux de fort niveau (peu ambigus) — on évite les mots trop génériques
  // comme « non »/« oui » seuls qui apparaissent dans presque toutes les
  // conversations et provoquent des faux positifs.
  const cancelKeywords = [
    "annul",
    "pas intéressé",
    "n'est pas intéressé",
    "ne veut pas",
    "refuse",
    "ne confirme pas",
    "ne pas livrer",
    "ne suis pas d'accord",
  ];
  const confirmKeywords = [
    "confirme",
    "confirmé",
    "je confirme",
    "d'accord pour la livraison",
    "c'est bon pour moi",
    "livrez",
    "vous pouvez livrer",
    "je suis disponible",
  ];
  const noAnswerKeywords = [
    "pas de réponse",
    "messagerie",
    "occupé",
    "voicemail",
    "no-answer",
    "répondeur",
  ];

  if (noAnswerKeywords.some((kw) => combined.includes(kw))) return "no_answer";
  if (cancelKeywords.some((kw) => combined.includes(kw))) return "cancelled";
  if (confirmKeywords.some((kw) => combined.includes(kw))) return "confirmed";

  // Aucun signal clair : NE PAS auto-confirmer (risque financier en COD).
  // On marque la commande pour un suivi manuel plutôt que de l'expédier.
  return "no_answer";
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-vapi-signature");

    if (!verifyVapiWebhook(rawBody, signature)) {
      console.warn("[vapi/webhook] Signature invalide");
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    const payload: VapiWebhookPayload = JSON.parse(rawBody);
    const { type } = payload.message;

    // Mise à jour du statut en temps réel
    if (type === "status-update") {
      const { call } = (payload as VapiStatusUpdate).message;
      await db
        .update(calls)
        .set({ status: call.status })
        .where(eq(calls.vapiCallId, call.id));

      return NextResponse.json({ received: true });
    }

    // Rapport de fin d'appel
    if (type === "end-of-call-report") {
      const { call, recordingUrl, transcript, summary } = (
        payload as VapiEndOfCallReport
      ).message;

      // Récupérer l'appel en base
      const callResult = await db
        .select()
        .from(calls)
        .where(eq(calls.vapiCallId, call.id))
        .limit(1);

      const dbCall = callResult[0];
      if (!dbCall) {
        console.error(`[vapi/webhook] Appel introuvable: ${call.id}`);
        return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
      }

      // Idempotence : Vapi peut rejouer ce rapport. Si l'appel a déjà été
      // facturé (coût enregistré), on ne re-débite PAS le wallet.
      if (dbCall.status === "completed" && dbCall.costFcfa !== null) {
        console.log(
          `[vapi/webhook] Rapport déjà traité pour ${call.id}, ignoré (idempotence)`
        );
        return NextResponse.json({ received: true, action: "already_processed" });
      }

      const costUsd = call.cost ?? 0;
      const costFcfa = calculateClientCostFcfa(costUsd);
      const durationSeconds = call.duration ?? 0;

      // Récupérer le wallet
      const walletResult = await db
        .select()
        .from(wallets)
        .where(eq(wallets.organizationId, dbCall.organizationId))
        .limit(1);

      const wallet = walletResult[0];

      // Analyser l'issue de la commande
      let orderOutcome: "confirmed" | "cancelled" | "no_answer" | null = null;
      if (dbCall.orderId && summary && transcript) {
        orderOutcome = analyzeCallOutcome(summary, transcript);
      }

      // Transaction atomique : mettre à jour l'appel + déduire du wallet
      await db.transaction(async (tx) => {
        // 1. Mettre à jour l'appel
        await tx
          .update(calls)
          .set({
            status: call.status === "ended" ? "completed" : call.status,
            durationSeconds,
            costUsd: costUsd.toString(),
            costFcfa: costFcfa.toString(),
            recordingUrl: recordingUrl ?? null,
            transcript: transcript ?? null,
            summary: summary ?? null,
            endedReason: call.endedReason ?? null,
          })
          .where(eq(calls.id, dbCall.id));

        // 2. Déduire le coût du wallet (si coût > 0)
        if (wallet && costFcfa > 0) {
          await tx.insert(transactions).values({
            walletId: wallet.id,
            type: "call_cost",
            amountFcfa: (-costFcfa).toString(),
            description: `Appel ${dbCall.type === "ecommerce_confirmation" ? "confirmation commande" : "prospection"} (${durationSeconds}s)`,
            metadata: {
              vapiCallId: call.id,
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

        // 3. Mettre à jour le statut de la commande
        if (dbCall.orderId && orderOutcome) {
          await tx
            .update(orders)
            .set({ status: orderOutcome })
            .where(eq(orders.id, dbCall.orderId));
        }

        // 4. Mettre à jour le statut du lead
        if (dbCall.leadId) {
          const leadStatus =
            summary?.toLowerCase().includes("intéressé") ||
            summary?.toLowerCase().includes("qualifié")
              ? "qualified"
              : "not_interested";

          await tx
            .update(leads)
            .set({ status: leadStatus, notes: summary ?? null })
            .where(eq(leads.id, dbCall.leadId));
        }
      });

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
