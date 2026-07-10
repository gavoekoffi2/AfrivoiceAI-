import { db } from "./index";
import { calls, orders, campaigns, wallets, transactions } from "./schema";
import { eq, and, desc, count, sql } from "drizzle-orm";

export type OrganizationStats = {
  totalCalls: number;
  confirmedOrders: number;
  confirmationRate: number;
  walletBalance: number;
  activeCampaigns: number;
};

const EMPTY_STATS: OrganizationStats = {
  totalCalls: 0,
  confirmedOrders: 0,
  confirmationRate: 0,
  walletBalance: 0,
  activeCampaigns: 0,
};

export async function getOrganizationStats(
  organizationId: string
): Promise<OrganizationStats> {
  try {
    const [
      totalCallsResult,
      confirmedOrdersResult,
      totalOrdersResult,
      walletResult,
      activeCampaignsResult,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(calls)
        .where(eq(calls.organizationId, organizationId)),

      db
        .select({ count: count() })
        .from(orders)
        .where(
          and(
            eq(orders.organizationId, organizationId),
            eq(orders.status, "confirmed")
          )
        ),

      db
        .select({ count: count() })
        .from(orders)
        .where(
          and(
            eq(orders.organizationId, organizationId),
            sql`status != 'pending'`
          )
        ),

      db
        .select({ balance: wallets.balanceFcfa })
        .from(wallets)
        .where(eq(wallets.organizationId, organizationId))
        .limit(1),

      db
        .select({ count: count() })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.organizationId, organizationId),
            eq(campaigns.status, "active")
          )
        ),
    ]);

    const totalCalls = totalCallsResult[0]?.count ?? 0;
    const confirmedOrders = confirmedOrdersResult[0]?.count ?? 0;
    const totalOrders = totalOrdersResult[0]?.count ?? 0;
    const walletBalance = parseFloat(walletResult[0]?.balance ?? "0");
    const activeCampaigns = activeCampaignsResult[0]?.count ?? 0;

    const confirmationRate =
      totalOrders > 0 ? Math.round((confirmedOrders / totalOrders) * 100) : 0;

    return {
      totalCalls,
      confirmedOrders,
      confirmationRate,
      walletBalance,
      activeCampaigns,
    };
  } catch (error) {
    // Fail-closed : jamais de fausses statistiques. On renvoie des zéros réels.
    console.error("[queries] getOrganizationStats a échoué:", error);
    return EMPTY_STATS;
  }
}

export async function getRecentCalls(
  organizationId: string,
  limit: number = 10
) {
  try {
    return await db
      .select()
      .from(calls)
      .where(eq(calls.organizationId, organizationId))
      .orderBy(desc(calls.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[queries] getRecentCalls a échoué:", error);
    return [];
  }
}

export async function getCallsChartData(organizationId: string) {
  try {
    const result = await db
      .select({
        date: sql<string>`DATE(${calls.createdAt})`,
        total: count(),
        completed: sql<number>`COUNT(CASE WHEN ${calls.status} = 'completed' THEN 1 END)`,
      })
      .from(calls)
      .where(
        and(
          eq(calls.organizationId, organizationId),
          sql`${calls.createdAt} >= NOW() - INTERVAL '7 days'`
        )
      )
      .groupBy(sql`DATE(${calls.createdAt})`)
      .orderBy(sql`DATE(${calls.createdAt})`);

    return result;
  } catch (error) {
    console.error("[queries] getCallsChartData a échoué:", error);
    return [];
  }
}

export async function getWalletWithTransactions(organizationId: string) {
  try {
    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, organizationId))
      .limit(1);

    // Aucun wallet : on renvoie null (pas de solde fictif). Les appelants
    // gèrent déjà ce cas (404 côté API, « 0 FCFA » côté UI).
    if (!wallet[0]) return null;

    const txHistory = await db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, wallet[0].id))
      .orderBy(desc(transactions.createdAt))
      .limit(20);

    return { wallet: wallet[0], transactions: txHistory };
  } catch (error) {
    // Fail-closed : jamais de solde fictif.
    console.error("[queries] getWalletWithTransactions a échoué:", error);
    return null;
  }
}
