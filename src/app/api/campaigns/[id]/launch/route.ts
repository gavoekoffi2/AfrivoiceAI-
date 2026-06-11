import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaigns, leads, wallets } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { hasSufficientBalance } from "@/lib/utils/billing";
import { initiateLeadCall } from "@/lib/calls/initiate";
import { isUuid } from "@/lib/utils";

// Les fonctions serverless (Netlify/Vercel) ont un timeout court (~10 s) :
// on lance de petits lots rapides, le client relance tant qu'il reste des leads.
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 250;

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
    if (!isUuid(campaignId)) {
      return NextResponse.json(
        { error: "Campagne introuvable" },
        { status: 404 }
      );
    }

    // Vérifier la campagne
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

    // Vérifier le solde
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

    // Récupérer les leads en attente
    const pendingLeads = await db
      .select()
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), eq(leads.status, "new")))
      .limit(BATCH_SIZE);

    if (pendingLeads.length === 0) {
      return NextResponse.json({
        launched: 0,
        remaining: 0,
        message: "Aucun lead en attente.",
      });
    }

    let launched = 0;
    let stoppedReason: string | null = null;
    const errors: string[] = [];

    for (const lead of pendingLeads) {
      const result = await initiateLeadCall({ lead, campaign });

      if (result.ok) {
        launched++;
      } else if (result.status === 402) {
        // Solde épuisé : inutile de continuer le lot
        stoppedReason = result.error;
        break;
      } else {
        console.error(
          `[batch/launch] Erreur pour lead ${lead.id}: ${result.error}`
        );
        errors.push(lead.id);
      }

      if (launched < pendingLeads.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    const remainingResult = await db
      .select({ count: count() })
      .from(leads)
      .where(and(eq(leads.campaignId, campaignId), eq(leads.status, "new")));
    const remaining = remainingResult[0]?.count ?? 0;

    return NextResponse.json({
      launched,
      remaining,
      errors: errors.length,
      message: stoppedReason
        ? `${launched} appel(s) lancé(s), puis arrêt : ${stoppedReason}`
        : `${launched} appel(s) lancé(s) avec succès.`,
    });
  } catch (error) {
    console.error("[batch/launch] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
