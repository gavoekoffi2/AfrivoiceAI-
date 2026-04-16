import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { wallets, transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { depositSchema } from "@/lib/validations/wallet";
import { sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const validated = depositSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { amountFcfa, paymentMethod = "manual" } = validated.data;

    // Récupérer le wallet
    const walletResult = await db
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, session.organizationId))
      .limit(1);

    const wallet = walletResult[0];
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet introuvable" },
        { status: 404 }
      );
    }

    // Transaction atomique : créer la transaction + mettre à jour le solde
    await db.transaction(async (tx) => {
      // 1. Insérer la transaction de dépôt
      await tx.insert(transactions).values({
        walletId: wallet.id,
        type: "deposit",
        amountFcfa: amountFcfa.toString(),
        description: `Recharge du wallet (${paymentMethod})`,
        metadata: { paymentMethod, requestedBy: session.id },
      });

      // 2. Incrémenter le solde
      await tx
        .update(wallets)
        .set({
          balanceFcfa: sql`${wallets.balanceFcfa} + ${amountFcfa}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
    });

    console.log(
      `[wallet/deposit] Org ${session.organizationId}: +${amountFcfa} FCFA`
    );

    return NextResponse.json({
      success: true,
      message: `${amountFcfa.toLocaleString("fr-TG")} FCFA ajoutés à votre wallet.`,
    });
  } catch (error) {
    console.error("[wallet/deposit] Erreur:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
