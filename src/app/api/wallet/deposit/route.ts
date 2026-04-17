import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { wallets, transactions, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { depositSchema } from "@/lib/validations/wallet";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { markWebhookProcessed } from "@/lib/idempotency";

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
    const requestId =
      typeof body?.requestId === "string" ? body.requestId : null;

    if (requestId) {
      const firstTime = await markWebhookProcessed({
        provider: "manual",
        externalId: `wallet_deposit_${requestId}`,
        organizationId: session.organizationId,
      });
      if (!firstTime) {
        return NextResponse.json({
          success: true,
          idempotent: true,
          message: "Requête déjà traitée.",
        });
      }
    }

    await db.transaction(async (tx) => {
      const lockedRows = await tx.execute(
        sql`SELECT id FROM wallets WHERE organization_id = ${session.organizationId} FOR UPDATE`
      );
      const lockedRow = Array.isArray(lockedRows)
        ? (lockedRows as unknown as { id: string }[])[0]
        : ((lockedRows as unknown as { rows?: { id: string }[] }).rows?.[0]);

      if (!lockedRow) {
        throw new Error("WALLET_NOT_FOUND");
      }

      await tx.insert(transactions).values({
        walletId: lockedRow.id,
        type: "adjustment",
        amountFcfa: amountFcfa.toString(),
        description: `Ajustement manuel (${paymentMethod})`,
        status: "completed",
        provider: "manual",
        metadata: { paymentMethod, requestedBy: session.id, requestId },
      });

      await tx
        .update(wallets)
        .set({
          balanceFcfa: sql`${wallets.balanceFcfa} + ${amountFcfa}`,
          lowBalanceAlertSent: false,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, lockedRow.id));
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
    if (error instanceof Error && error.message === "WALLET_NOT_FOUND") {
      return NextResponse.json(
        { error: "Wallet introuvable" },
        { status: 404 }
      );
    }
    logger.error("wallet/deposit", "Erreur serveur", { error: String(error) });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
