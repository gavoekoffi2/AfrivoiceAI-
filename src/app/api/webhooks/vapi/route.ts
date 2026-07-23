import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calls,
  orders,
  leads,
  wallets,
  transactions,
  organizationBillingProfiles,
} from "@/lib/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { verifyVapiWebhook } from "@/lib/vapi/verify";
import {
  allocateBillableMinutes,
  calculateCallChargeFcfa,
  getBillingPlan,
} from "@/lib/billing/plans";
import { classifyProspectingOutcome } from "@/lib/prospecting";
import { extractVapiCallArtifacts } from "@/lib/vapi/artifacts";

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
    artifact?: Record<string, unknown>;
    analysis?: Record<string, unknown>;
    messages?: unknown[];
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

  const cancelKeywords = [
    "annul",
    "annulé",
    "pas intéressé",
    "non",
    "refuse",
    "ne veut pas",
    "n'est pas intéressé",
  ];
  const confirmKeywords = [
    "confirme",
    "confirmé",
    "oui",
    "d'accord",
    "ok",
    "parfait",
    "livrer",
    "disponible",
  ];
  const noAnswerKeywords = [
    "pas de réponse",
    "messagerie",
    "occupé",
    "voicemail",
    "no-answer",
  ];

  if (noAnswerKeywords.some((kw) => combined.includes(kw))) return "no_answer";
  if (cancelKeywords.some((kw) => combined.includes(kw))) return "cancelled";
  if (confirmKeywords.some((kw) => combined.includes(kw))) return "confirmed";

  return "confirmed"; // Par défaut si l'appel s'est terminé normalement
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
      const { call } = (
        payload as VapiEndOfCallReport
      ).message;
      const { recordingUrl, transcript, summary, messages, rawArtifact } =
        extractVapiCallArtifacts((payload as VapiEndOfCallReport).message);

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

      // Idempotence financière : un rapport Vapi répété ne doit jamais redébiter.
      if (dbCall.status === "completed" && dbCall.costFcfa !== null) {
        return NextResponse.json({ received: true, processed: true, duplicate: true });
      }

      const costUsd = call.cost ?? 0;
      const durationSeconds = call.duration ?? 0;

      const [walletResult, billingProfile] = await Promise.all([
        db
          .select()
          .from(wallets)
          .where(eq(wallets.organizationId, dbCall.organizationId))
          .limit(1),
        db.query.organizationBillingProfiles.findFirst({
          where: eq(
            organizationBillingProfiles.organizationId,
            dbCall.organizationId
          ),
        }),
      ]);

      const wallet = walletResult[0];
      let plan = getBillingPlan(billingProfile?.planCode);
      let charge = calculateCallChargeFcfa({
        planCode: plan.code,
        durationSeconds,
        providerCostUsd: costUsd,
        exchangeRateUsdToFcfa: 620,
      });
      const includedMinutes =
        billingProfile?.includedMinutesMonthly ?? plan.includedMinutes;
      const usedMinutes = Number(billingProfile?.usedMinutesThisCycle ?? 0);
      const bonusMinutes = Number(billingProfile?.bonusMinutesBalance ?? 0);
      let allocation = allocateBillableMinutes({
        billableMinutes: charge.billableMinutes,
        monthlyMinutesRemaining: Math.max(0, includedMinutes - usedMinutes),
        bonusMinutesBalance: bonusMinutes,
      });
      const coveredMinuteValue =
        (allocation.monthlyMinutesUsed + allocation.bonusMinutesUsed) *
        plan.minuteRateFcfa;
      let costFcfa = Math.ceil(
        Math.max(
          allocation.overageMinutes * plan.minuteRateFcfa,
          charge.providerFloorFcfa - coveredMinuteValue,
          0
        )
      );

      // Analyser l'issue de la commande
      let orderOutcome: "confirmed" | "cancelled" | "no_answer" | null = null;
      if (dbCall.orderId && summary && transcript) {
        orderOutcome = analyzeCallOutcome(summary, transcript);
      }

      // Transaction atomique : mettre à jour l'appel + déduire du wallet
      await db.transaction(async (tx) => {
        // Sérialiser la consommation des minutes pour une même organisation.
        await tx.execute(sql`
          SELECT organization_id
          FROM organization_billing_profiles
          WHERE organization_id = ${dbCall.organizationId}
          FOR UPDATE
        `);
        const lockedProfile =
          await tx.query.organizationBillingProfiles.findFirst({
            where: eq(
              organizationBillingProfiles.organizationId,
              dbCall.organizationId
            ),
          });
        plan = getBillingPlan(lockedProfile?.planCode);
        charge = calculateCallChargeFcfa({
          planCode: plan.code,
          durationSeconds,
          providerCostUsd: costUsd,
          exchangeRateUsdToFcfa: 620,
        });
        const lockedIncludedMinutes =
          lockedProfile?.includedMinutesMonthly ?? plan.includedMinutes;
        const lockedUsedMinutes = Number(
          lockedProfile?.usedMinutesThisCycle ?? 0
        );
        const lockedBonusMinutes = Number(
          lockedProfile?.bonusMinutesBalance ?? 0
        );
        allocation = allocateBillableMinutes({
          billableMinutes: charge.billableMinutes,
          monthlyMinutesRemaining: Math.max(
            0,
            lockedIncludedMinutes - lockedUsedMinutes
          ),
          bonusMinutesBalance: lockedBonusMinutes,
        });
        const lockedCoveredValue =
          (allocation.monthlyMinutesUsed + allocation.bonusMinutesUsed) *
          plan.minuteRateFcfa;
        costFcfa = Math.ceil(
          Math.max(
            allocation.overageMinutes * plan.minuteRateFcfa,
            charge.providerFloorFcfa - lockedCoveredValue,
            0
          )
        );

        // 1. Mettre à jour l'appel une seule fois, même en cas de webhook concurrent.
        const claimedCall = await tx
          .update(calls)
          .set({
            status: "completed",
            durationSeconds,
            costUsd: costUsd.toString(),
            costFcfa: costFcfa.toString(),
            billedMinuteRateFcfa: plan.minuteRateFcfa.toString(),
            recordingUrl: recordingUrl ?? null,
            transcript: transcript ?? null,
            summary: summary ?? null,
            callMessages: messages ?? null,
            callArtifact: rawArtifact ?? null,
            endedReason: call.endedReason ?? null,
          })
          .where(
            and(eq(calls.id, dbCall.id), ne(calls.status, "completed"))
          )
          .returning({ id: calls.id });

        if (!claimedCall[0]) return;

        // 2. Consommer d’abord le forfait mensuel, puis les minutes bonus.
        await tx
          .insert(organizationBillingProfiles)
          .values({
            organizationId: dbCall.organizationId,
            planCode: plan.code,
            status: "active",
            includedMinutesMonthly: plan.includedMinutes,
            usedMinutesThisCycle: allocation.monthlyMinutesUsed.toString(),
            bonusMinutesBalance: "0",
          })
          .onConflictDoUpdate({
            target: organizationBillingProfiles.organizationId,
            set: {
              usedMinutesThisCycle: sql`${organizationBillingProfiles.usedMinutesThisCycle} + ${allocation.monthlyMinutesUsed}`,
              bonusMinutesBalance: sql`${organizationBillingProfiles.bonusMinutesBalance} - ${allocation.bonusMinutesUsed}`,
              updatedAt: new Date(),
            },
          });

        // 3. Déduire uniquement le dépassement ou le surcoût fournisseur.
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
              planCode: plan.code,
              monthlyMinutesUsed: allocation.monthlyMinutesUsed,
              bonusMinutesUsed: allocation.bonusMinutesUsed,
              overageMinutes: allocation.overageMinutes,
              providerFloorFcfa: charge.providerFloorFcfa,
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
          const leadStatus = classifyProspectingOutcome({
            summary,
            transcript,
            endedReason: call.endedReason,
          });

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
