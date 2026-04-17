import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { wallets, transactions, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { depositSchema } from "@/lib/validations/wallet";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Ajustement manuel du wallet — réservé aux owners/admins.
 * Pour les recharges utilisateur, utilisez /api/wallet/checkout (Stripe).
 */
export async function POST(req: Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const rl = rateLimit(`wallet:deposit:${session.organizationId}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Trop d'ajustements en peu de temps." },
        { status: 429 }
      );
    }

    const userRow = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    const role = userRow[0]?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Ajustement manuel réservé aux administrateurs. Utilisez la recharge Stripe pour créditer votre wallet.",
        },
        { status: 403 }
      );
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

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        walletId: wallet.id,
        type: "adjustment",
        amountFcfa: amountFcfa.toString(),
        description: `Ajustement manuel (${paymentMethod})`,
        status: "completed",
        provider: "manual",
        metadata: { paymentMethod, requestedBy: session.id },
      });

      await tx
        .update(wallets)
        .set({
          balanceFcfa: sql`${wallets.balanceFcfa} + ${amountFcfa}`,
          lowBalanceAlertSent: false,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
    });

    logger.info("wallet/deposit", "Ajustement manuel", {
      organizationId: session.organizationId,
      amountFcfa,
      by: session.id,
    });

    return NextResponse.json({
      success: true,
      message: `${amountFcfa.toLocaleString(
        "fr-FR"
      )} FCFA ajoutés au wallet.`,
    });
  } catch (error) {
    logger.error("wallet/deposit", "Erreur serveur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
