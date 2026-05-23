import { db } from "@/lib/db";
import { wallets, transactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("wallet");

export type WalletDebitInput = {
  organizationId: string;
  amountFcfa: number;
  description: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  allowNegative?: boolean;
};

export type WalletCreditInput = {
  organizationId: string;
  amountFcfa: number;
  type?: "deposit" | "refund" | "adjustment";
  description: string;
  metadata?: Record<string, unknown>;
  externalReference?: string;
  idempotencyKey?: string;
};

export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "wallet_not_found"
      | "insufficient_balance"
      | "duplicate_transaction"
      | "invalid_amount"
  ) {
    super(message);
    this.name = "WalletError";
  }
}

/**
 * Crédite le wallet d'une organisation de façon atomique et idempotente.
 */
export async function creditWallet(input: WalletCreditInput) {
  if (!Number.isFinite(input.amountFcfa) || input.amountFcfa <= 0) {
    throw new WalletError("Montant invalide", "invalid_amount");
  }

  return db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, input.organizationId))
      .for("update")
      .limit(1);

    if (!wallet) throw new WalletError("Wallet introuvable", "wallet_not_found");

    if (input.idempotencyKey) {
      const existing = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing[0]) {
        throw new WalletError(
          "Transaction déjà appliquée",
          "duplicate_transaction"
        );
      }
    }

    const newBalance = parseFloat(wallet.balanceFcfa) + input.amountFcfa;

    await tx
      .update(wallets)
      .set({
        balanceFcfa: newBalance.toFixed(2),
        version: wallet.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    await tx.insert(transactions).values({
      walletId: wallet.id,
      type: input.type ?? "deposit",
      amountFcfa: input.amountFcfa.toFixed(2),
      balanceAfterFcfa: newBalance.toFixed(2),
      description: input.description,
      metadata: input.metadata as never,
      externalReference: input.externalReference,
      idempotencyKey: input.idempotencyKey,
    });

    log.info("Wallet crédité", {
      organizationId: input.organizationId,
      amount: input.amountFcfa,
      newBalance,
    });

    return { newBalanceFcfa: newBalance };
  });
}

/**
 * Débite le wallet (coût d'appel) avec verrouillage SELECT FOR UPDATE.
 * - Idempotent via idempotencyKey (ex: vapiCallId).
 * - Empêche le solde négatif sauf si `allowNegative` est true.
 */
export async function debitWallet(input: WalletDebitInput) {
  if (!Number.isFinite(input.amountFcfa) || input.amountFcfa < 0) {
    throw new WalletError("Montant invalide", "invalid_amount");
  }
  if (input.amountFcfa === 0) {
    return { newBalanceFcfa: null, skipped: true as const };
  }

  return db.transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing[0]) {
        log.info("Débit ignoré (idempotency)", {
          idempotencyKey: input.idempotencyKey,
        });
        return { newBalanceFcfa: null, skipped: true as const };
      }
    }

    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, input.organizationId))
      .for("update")
      .limit(1);

    if (!wallet) throw new WalletError("Wallet introuvable", "wallet_not_found");

    const currentBalance = parseFloat(wallet.balanceFcfa);
    const newBalance = currentBalance - input.amountFcfa;

    if (!input.allowNegative && newBalance < 0) {
      throw new WalletError(
        "Solde insuffisant pour cette opération",
        "insufficient_balance"
      );
    }

    await tx
      .update(wallets)
      .set({
        balanceFcfa: newBalance.toFixed(2),
        version: wallet.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    await tx.insert(transactions).values({
      walletId: wallet.id,
      type: "call_cost",
      amountFcfa: (-input.amountFcfa).toFixed(2),
      balanceAfterFcfa: newBalance.toFixed(2),
      description: input.description,
      metadata: input.metadata as never,
      idempotencyKey: input.idempotencyKey,
    });

    log.info("Wallet débité", {
      organizationId: input.organizationId,
      amount: input.amountFcfa,
      newBalance,
    });

    return { newBalanceFcfa: newBalance, skipped: false as const };
  });
}

/**
 * Lit le solde actuel sans verrou.
 */
export async function getBalance(organizationId: string): Promise<number> {
  const [w] = await db
    .select({ balance: wallets.balanceFcfa })
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);
  return w ? parseFloat(w.balance) : 0;
}
