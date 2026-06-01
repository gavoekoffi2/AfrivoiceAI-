import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, orders, leads, wallets, transactions } from "@/lib/db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Détecte un mot/expression en respectant les frontières de mots (FR/EN). */
function mentions(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => {
    if (/\s/.test(kw)) return text.includes(kw);
    const re = new RegExp(
      `(^|[^a-zàâäéèêëîïôöùûüç])${escapeRegExp(kw)}([^a-zàâäéèêëîïôöùûüç]|$)`,
      "i"
    );
    return re.test(text);
  });
}

/**
 * Détermine l'issue d'une commande à partir du résumé IA (signal principal,
 * plus fiable que le transcript brut qui contient le script de l'assistant).
 *
 * Choix produit : en cas d'ambiguïté on NE confirme PAS automatiquement —
 * confirmer à tort une commande COD entraîne une livraison non désirée et une
 * perte financière. Le défaut sûr est "no_answer" (revue manuelle / relance).
 */
function analyzeCallOutcome(
  summary: string,
  transcript: string
): "confirmed" | "cancelled" | "no_answer" {
  const primary = (summary || "").toLowerCase();
  const full = `${summary || ""} ${transcript || ""}`.toLowerCase();

  const noAnswerKw = [
    "pas de réponse",
    "n'a pas répondu",
    "ne répond pas",
    "messagerie",
    "répondeur",
    "voicemail",
    "injoignable",
    "occupé",
    "no answer",
    "no-answer",
    "did not answer",
  ];
  const cancelKw = [
    "annul",
    "annulé",
    "annulée",
    "ne confirme pas",
    "pas intéressé",
    "n'est pas intéressé",
    "refuse",
    "refusé",
    "ne veut pas",
    "ne souhaite pas",
    "mauvais numéro",
    "cancel",
    "cancelled",
    "not interested",
    "declined",
  ];
  const confirmKw = [
    "confirme",
    "confirmé",
    "confirmée",
    "a confirmé",
    "accepte",
    "accepté",
    "validé",
    "valide la commande",
    "d'accord pour",
    "sera disponible",
    "confirm",
    "confirmed",
    "accepted",
    "agreed",
  ];

  // Boîte vocale / absence de réponse : prioritaire.
  if (mentions(full, noAnswerKw)) return "no_answer";
  // Annulation explicite prime sur confirmation.
  if (mentions(primary, cancelKw)) return "cancelled";
  if (mentions(primary, confirmKw)) return "confirmed";
  // Repli sur le transcript complet pour une confirmation explicite.
  if (mentions(full, cancelKw)) return "cancelled";
  if (mentions(full, confirmKw)) return "confirmed";

  // Ambigu -> défaut sûr (pas d'auto-confirmation).
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
      const { call, recordingUrl, transcript, summary } = (
        payload as VapiEndOfCallReport
      ).message;

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

      let orderOutcome: "confirmed" | "cancelled" | "no_answer" | null = null;
      if (dbCall.orderId) {
        orderOutcome = analyzeCallOutcome(summary ?? "", transcript ?? "");
      }

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
          const s = (summary ?? "").toLowerCase();
          const leadStatus =
            mentions(s, ["intéressé", "qualifié", "interested", "qualified"])
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
