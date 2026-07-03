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

const DEMO_STATS: OrganizationStats = {
  totalCalls: 128,
  confirmedOrders: 47,
  confirmationRate: 64,
  walletBalance: 75000,
  activeCampaigns: 3,
};

const DEMO_CHART = [
  { date: "Lun", total: 9, completed: 6 },
  { date: "Mar", total: 14, completed: 9 },
  { date: "Mer", total: 18, completed: 12 },
  { date: "Jeu", total: 22, completed: 15 },
  { date: "Ven", total: 31, completed: 21 },
  { date: "Sam", total: 17, completed: 11 },
  { date: "Dim", total: 24, completed: 16 },
];

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
    console.warn("[demo] Statistiques DB indisponibles, fallback démo:", error);
    return DEMO_STATS;
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
    console.warn("[demo] Appels récents DB indisponibles, fallback démo:", error);
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

    return result.length ? result : DEMO_CHART;
  } catch (error) {
    console.warn("[demo] Graphique appels DB indisponible, fallback démo:", error);
    return DEMO_CHART;
  }
}

export async function getWalletWithTransactions(organizationId: string) {
  try {
    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.organizationId, organizationId))
      .limit(1);

    if (!wallet[0]) {
      return {
        wallet: {
          id: "demo-wallet",
          organizationId,
          balanceFcfa: "75000",
          currency: "XOF",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        transactions: [],
      };
    }

    const txHistory = await db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, wallet[0].id))
      .orderBy(desc(transactions.createdAt))
      .limit(20);

    return { wallet: wallet[0], transactions: txHistory };
  } catch (error) {
    console.warn("[demo] Wallet DB indisponible, fallback démo:", error);
    return {
      wallet: {
        id: "demo-wallet",
        organizationId,
        balanceFcfa: "75000",
        currency: "XOF",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      transactions: [],
    };
  }
}
