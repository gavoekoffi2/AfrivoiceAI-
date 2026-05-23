import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaigns, leads } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { triggerCall } from "@/lib/calls/trigger";
import { getBalance } from "@/lib/wallet/service";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api/campaigns/launch");
const BATCH_SIZE = 10;
const INTER_CALL_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`batch-launch:${session.organizationId}:${ip}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Trop de lancements de batch — patientez 1 minute" },
      { status: 429 }
    );
  }

  const campaignId = params.id;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.organizationId, session.organizationId)
      )
    )
    .limit(1);

  if (!campaign) {
    return NextResponse.json(
      { error: "Campagne introuvable" },
      { status: 404 }
    );
  }
  if (campaign.status !== "active") {
    return NextResponse.json(
      { error: "La campagne doit être active pour lancer des appels." },
      { status: 400 }
    );
  }

  const balance = await getBalance(session.organizationId);
  if (!hasSufficientBalance(balance)) {
    return NextResponse.json(
      { error: "Solde insuffisant pour lancer des appels." },
      { status: 402 }
    );
  }

  // Sélection atomique des leads "new" → "queueing" pour éviter qu'un
  // double-click ou un batch parallèle ne traite deux fois les mêmes leads.
  const queued = await db
    .update(leads)
    .set({ status: "queueing" })
    .where(
      sql`${leads.id} IN (
        SELECT id FROM ${leads}
        WHERE campaign_id = ${campaignId}
          AND status = 'new'
        ORDER BY created_at
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )`
    )
    .returning();

  if (queued.length === 0) {
    return NextResponse.json({
      launched: 0,
      message: "Aucun lead en attente.",
    });
  }

  let launched = 0;
  const errors: string[] = [];

  for (const lead of queued) {
    // Re-check du solde avant chaque appel (évite de partir en négatif)
    const freshBalance = await getBalance(session.organizationId);
    if (!hasSufficientBalance(freshBalance)) {
      // Replace les leads non-traités en "new"
      await db
        .update(leads)
        .set({ status: "new" })
        .where(and(eq(leads.id, lead.id), eq(leads.status, "queueing")));
      log.warn("Arrêt batch : solde insuffisant", { campaignId });
      break;
    }

    const result = await triggerCall({
      organizationId: session.organizationId,
      leadId: lead.id,
      campaignId,
    });

    if (result.success) {
      launched++;
    } else {
      errors.push(`${lead.id}: ${result.reason}`);
      // Remettre en "new" si l'appel n'a pas pu être créé
      await db
        .update(leads)
        .set({ status: "new" })
        .where(and(eq(leads.id, lead.id), eq(leads.status, "queueing")));
    }

    if (launched < queued.length) {
      await sleep(INTER_CALL_DELAY_MS);
    }
  }

  // Mise à jour du compteur via SQL atomique (évite la race condition)
  await db
    .update(campaigns)
    .set({
      calledLeads: sql`${campaigns.calledLeads} + ${launched}`,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  log.info("Batch terminé", { campaignId, launched, errors: errors.length });

  return NextResponse.json({
    launched,
    errors: errors.length,
    message:
      launched > 0
        ? `${launched} appel(s) lancé(s) avec succès.`
        : "Aucun appel n'a pu être lancé.",
  });
}
