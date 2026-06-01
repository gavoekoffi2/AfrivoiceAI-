import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaigns, leads, wallets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { initiateProspectingCall } from "@/lib/calls/initiate";

const BATCH_DELAY_MS = 2000; // 2 secondes entre chaque appel
const MAX_BATCH = 10; // Limite d'appels par lot

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    const walletResult = await db
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, session.organizationId))
      .limit(1);

    if (!walletResult[0] || !hasSufficientBalance(walletResult[0].balanceFcfa)) {
      return NextResponse.json(
        { error: "Solde insuffisant pour lancer des appels." },
        { status: 402 }
      );
    }

    const pendingLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), eq(leads.status, "new")))
      .limit(MAX_BATCH);

    if (pendingLeads.length === 0) {
      return NextResponse.json({
        launched: 0,
        message: "Aucun lead en attente.",
      });
    }

    let launched = 0;
    let errors = 0;
    let stoppedForBalance = false;

    for (const [index, lead] of pendingLeads.entries()) {
      const result = await initiateProspectingCall(
        lead.id,
        campaignId,
        session.organizationId
      );

      if (result.ok) {
        launched++;
      } else if (result.code === "insufficient_balance") {
        // La logique partagée revérifie le solde à chaque appel : on s'arrête net.
        stoppedForBalance = true;
        break;
      } else {
        errors++;
        console.error(`[batch/launch] Échec lead ${lead.id}: ${result.code}`);
      }

      // Délai entre les appels pour éviter les rate limits Vapi.
      if (index < pendingLeads.length - 1) {
        await sleep(BATCH_DELAY_MS);
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
      errors,
      stoppedForBalance,
      message: stoppedForBalance
        ? `${launched} appel(s) lancé(s). Arrêt : solde insuffisant.`
        : `${launched} appel(s) lancé(s) avec succès.`,
    });
  } catch (error) {
    console.error("[batch/launch] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
