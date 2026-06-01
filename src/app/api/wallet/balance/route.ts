import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { getWalletWithTransactions } from "@/lib/db/queries";

// Données propres à l'utilisateur connecté : jamais mises en cache.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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
    console.error("[wallet/balance] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
