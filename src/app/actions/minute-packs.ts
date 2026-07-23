"use server";

import { randomUUID } from "crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUserSession } from "@/lib/auth";
import { getMinutePack } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import {
  organizationBillingProfiles,
  transactions,
  wallets,
} from "@/lib/db/schema";

export async function buyMinutePackAction(packCode: string) {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const pack = getMinutePack(packCode);
  if (!pack) return { error: "Pack de minutes invalide." };

  const reference = `MIN-${randomUUID().slice(0, 10).toUpperCase()}`;

  try {
    const result = await db.transaction(async (tx) => {
      const wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.organizationId, session.organizationId),
      });
      if (!wallet) return { error: "Wallet introuvable." } as const;

      const debited = await tx
        .update(wallets)
        .set({
          balanceFcfa: sql`${wallets.balanceFcfa} - ${pack.priceFcfa}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(wallets.id, wallet.id),
            gte(wallets.balanceFcfa, pack.priceFcfa.toString())
          )
        )
        .returning({ id: wallets.id });

      if (!debited[0]) {
        return {
          error: `Solde insuffisant. Rechargez au moins ${pack.priceFcfa.toLocaleString("fr-TG")} FCFA.`,
        } as const;
      }

      await tx
        .insert(organizationBillingProfiles)
        .values({
          organizationId: session.organizationId,
          planCode: "essential",
          status: "active",
          includedMinutesMonthly: 60,
          bonusMinutesBalance: pack.minutes.toString(),
        })
        .onConflictDoUpdate({
          target: organizationBillingProfiles.organizationId,
          set: {
            bonusMinutesBalance: sql`${organizationBillingProfiles.bonusMinutesBalance} + ${pack.minutes}`,
            updatedAt: new Date(),
          },
        });

      await tx.insert(transactions).values({
        walletId: wallet.id,
        type: "minute_pack",
        amountFcfa: (-pack.priceFcfa).toString(),
        description: `Pack ${pack.name} — ${pack.minutes} minutes supplémentaires`,
        metadata: {
          packCode: pack.code,
          minutes: pack.minutes,
          reference,
          requestedBy: session.id,
        },
      });

      return { success: true, reference } as const;
    });

    if ("error" in result) return result;
    revalidatePath("/wallet");
    revalidatePath("/phone-lines");
    return result;
  } catch (error) {
    console.error("[minute-packs/buy]", error);
    return { error: "Impossible d’acheter ce pack pour le moment." };
  }
}
