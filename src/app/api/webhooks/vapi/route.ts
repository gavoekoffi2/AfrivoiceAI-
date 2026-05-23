import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calls, orders, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyVapiWebhook } from "@/lib/vapi/verify";
import { calculateClientCostFcfa } from "@/lib/utils/billing";
import { debitWallet, WalletError } from "@/lib/wallet/service";
import { recordWebhookEvent } from "@/lib/webhooks/idempotency";
import { vapiWebhookSchema } from "@/lib/validations/webhooks";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("vapi/webhook");

type EcommerceOutcome = "confirmed" | "cancelled" | "no_answer" | "voicemail";
type ProspectingOutcome =
  | "qualified"
  | "not_interested"
  | "callback_requested"
  | "no_answer"
  | "voicemail"
  | "wrong_number";

/**
 * Extrait l'outcome d'un appel depuis les tool calls Vapi.
 * Fiabilité de l'analyse > 95% vs. parsing par mots-clés.
 */
function extractStructuredOutcome(
  message: ReturnType<typeof vapiWebhookSchema.parse>["message"]
): Record<string, unknown> | null {
  const candidates = [
    ...(message.toolCallList ?? []),
    ...(message.toolCalls ?? []),
    ...(message.functionCall ? [message.functionCall] : []),
  ];

  for (const c of candidates) {
    if (
      c.name === "recordOrderOutcome" ||
      c.name === "recordProspectingOutcome"
    ) {
      const args = c.arguments;
      if (typeof args === "string") {
        try {
          return JSON.parse(args);
        } catch {
          return null;
        }
      }
      if (args && typeof args === "object") {
        return args as Record<string, unknown>;
      }
    }
  }
  return null;
}

/**
 * Fallback heuristique si l'IA n'a pas appelé le tool.
 * Plus conservateur que l'ancien code : pas de confirmation par défaut.
 */
function fallbackEcommerceOutcome(
  endedReason: string | null,
  summary: string,
  transcript: string
): EcommerceOutcome {
  const r = (endedReason ?? "").toLowerCase();
  if (r.includes("voicemail")) return "voicemail";
  if (r.includes("no-answer") || r.includes("busy") || r.includes("declined"))
    return "no_answer";

  const combined = `${summary} ${transcript}`.toLowerCase();
  if (!combined.trim()) return "no_answer";

  const cancel = /\b(annul|pas intéressé|refuse|ne veut pas|n'est pas intéressé)\b/;
  const confirm = /\b(confirme|confirmé|d'accord|c'est ok|parfait, livr|disponible)\b/;
  if (cancel.test(combined)) return "cancelled";
  if (confirm.test(combined)) return "confirmed";

  return "no_answer";
}

function fallbackProspectingOutcome(
  summary: string,
  transcript: string
): ProspectingOutcome {
  const combined = `${summary} ${transcript}`.toLowerCase();
  if (!combined.trim()) return "no_answer";
  if (/\b(intéressé|qualifié|d'accord pour|rendez-vous|démo)\b/.test(combined))
    return "qualified";
  if (/\b(pas intéressé|non merci|ne veut pas|refuse)\b/.test(combined))
    return "not_interested";
  return "no_answer";
}

export async function POST(req: Request) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const signature =
    req.headers.get("x-vapi-signature") ?? req.headers.get("x-vapi-secret");

  if (!verifyVapiWebhook(rawBody, signature)) {
    log.warn("Signature invalide");
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = vapiWebhookSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    log.warn("Payload invalide", { error: String(err) });
    return NextResponse.json({ error: "Payload invalide" }, { status: 422 });
  }

  const { message } = parsed;
  const { type, call } = message;

  try {
    // --- Status update : maj statut seul ----------------------------------
    if (type === "status-update" && call) {
      await db
        .update(calls)
        .set({ status: call.status ?? "in-progress", updatedAt: new Date() })
        .where(eq(calls.vapiCallId, call.id));
      return NextResponse.json({ received: true });
    }

    // --- End of call report -----------------------------------------------
    if (type === "end-of-call-report" && call) {
      // Idempotency : événement = vapi call id + type
      const { isNew } = await recordWebhookEvent({
        source: "vapi",
        externalEventId: `eocr:${call.id}`,
        payload: parsed,
      });
      if (!isNew) {
        log.info("Événement déjà traité", { vapiCallId: call.id });
        return NextResponse.json({ received: true, duplicate: true });
      }

      const [dbCall] = await db
        .select()
        .from(calls)
        .where(eq(calls.vapiCallId, call.id))
        .limit(1);

      if (!dbCall) {
        log.error("Appel introuvable", { vapiCallId: call.id });
        return NextResponse.json(
          { error: "Appel introuvable" },
          { status: 404 }
        );
      }

      const costUsd = call.cost ?? 0;
      const costFcfa = calculateClientCostFcfa(costUsd);
      const durationSeconds = call.duration ?? 0;
      const summary = message.summary ?? "";
      const transcript = message.transcript ?? "";
      const endedReason = call.endedReason ?? message.endedReason ?? null;

      const structured = extractStructuredOutcome(message);

      // Outcome déterminé : structured > fallback
      let outcome: EcommerceOutcome | ProspectingOutcome;
      if (dbCall.type === "ecommerce_confirmation") {
        outcome =
          (structured?.outcome as EcommerceOutcome | undefined) ??
          fallbackEcommerceOutcome(endedReason, summary, transcript);
      } else {
        outcome =
          (structured?.outcome as ProspectingOutcome | undefined) ??
          fallbackProspectingOutcome(summary, transcript);
      }

      // 1) Mise à jour de l'appel
      await db
        .update(calls)
        .set({
          status: call.status === "ended" ? "completed" : (call.status ?? "completed"),
          durationSeconds,
          costUsd: costUsd.toFixed(4),
          costFcfa: costFcfa.toFixed(2),
          recordingUrl: message.recordingUrl ?? null,
          transcript: transcript || null,
          summary: summary || null,
          endedReason,
          structuredResult: structured as never,
          outcome,
          updatedAt: new Date(),
        })
        .where(eq(calls.id, dbCall.id));

      // 2) Débit du wallet (idempotent via vapiCallId)
      if (costFcfa > 0) {
        try {
          await debitWallet({
            organizationId: dbCall.organizationId,
            amountFcfa: costFcfa,
            description: `Appel ${dbCall.type === "ecommerce_confirmation" ? "confirmation commande" : "prospection"} (${durationSeconds}s)`,
            metadata: { vapiCallId: call.id, costUsd, durationSeconds },
            idempotencyKey: `call:${call.id}`,
            allowNegative: true, // le coût est déjà engagé, on l'enregistre même si négatif
          });
        } catch (err) {
          if (err instanceof WalletError) {
            log.warn("Débit wallet refusé", { code: err.code, vapiCallId: call.id });
          } else {
            throw err;
          }
        }
      }

      // 3) Mise à jour commande
      if (dbCall.orderId) {
        const orderStatus =
          outcome === "confirmed"
            ? "confirmed"
            : outcome === "cancelled"
            ? "cancelled"
            : outcome === "no_answer" || outcome === "voicemail"
            ? "no_answer"
            : null;

        if (orderStatus) {
          await db
            .update(orders)
            .set({ status: orderStatus, updatedAt: new Date() })
            .where(eq(orders.id, dbCall.orderId));
        }
      }

      // 4) Mise à jour lead
      if (dbCall.leadId) {
        const leadStatus =
          outcome === "qualified"
            ? "qualified"
            : outcome === "not_interested" || outcome === "wrong_number"
            ? "not_interested"
            : outcome === "no_answer" || outcome === "voicemail"
            ? "no_answer"
            : "called";

        const notes =
          (structured?.notes as string | undefined) ??
          (summary ? summary.slice(0, 500) : null);

        await db
          .update(leads)
          .set({ status: leadStatus, notes: notes ?? null })
          .where(eq(leads.id, dbCall.leadId));
      }

      log.info("Appel terminé", {
        vapiCallId: call.id,
        durationSeconds,
        costFcfa,
        outcome,
      });

      return NextResponse.json({ received: true, processed: true, outcome });
    }

    // Autres types d'événements : accusé réception
    return NextResponse.json({ received: true, type });
  } catch (err) {
    log.error("Erreur traitement webhook", { error: String(err) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
