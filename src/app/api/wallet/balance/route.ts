import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { getWalletWithTransactions } from "@/lib/db/queries";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rl = rateLimit(`wallet:balance:${session.id}`, 60, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Trop de requêtes." },
        { status: 429 }
      );
    }

    const data = await getWalletWithTransactions(session.organizationId);

    if (!data) {
      return NextResponse.json(
        { error: "Wallet introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      balanceFcfa: data.wallet.balanceFcfa,
      transactions: data.transactions,
    });
  } catch (error) {
    logger.error("wallet/balance", "Erreur serveur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
