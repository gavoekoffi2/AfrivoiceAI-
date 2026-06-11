import { db } from "./index";
import {
  calls,
  orders,
  campaigns,
  wallets,
  transactions,
  leads,
} from "./schema";
import { eq, and, desc, count, sql } from "drizzle-orm";

export type OrganizationStats = {
  totalCalls: number;
  confirmedOrders: number;
  confirmationRate: number;
  walletBalance: number;
  activeCampaigns: number;
};

export async function getOrganizationStats(
  organizationId: string
): Promise<OrganizationStats> {
  const [
    totalCallsResult,
    confirmedOrdersResult,
    totalOrdersResult,
    walletResult,
    activeCampaignsResult,
  ] = await Promise.all([
    // Total des appels
    db
      .select({ count: count() })
      .from(calls)
      .where(eq(calls.organizationId, organizationId)),

    // Commandes confirmées
    db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.status, "confirmed")
        )
      ),

    // Total des commandes COD (hors pending original)
    db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          sql`status != 'pending'`
        )
      ),

    // Solde du wallet
    db
      .select({ balance: wallets.balanceFcfa })
      .from(wallets)
      .where(eq(wallets.organizationId, organizationId))
      .limit(1),

    // Campagnes actives
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
}

export async function getRecentCalls(
  organizationId: string,
  limit: number = 10
) {
  return db
    .select()
    .from(calls)
    .where(eq(calls.organizationId, organizationId))
    .orderBy(desc(calls.createdAt))
    .limit(limit);
}

export async function getCallsChartData(organizationId: string) {
  // Appels des 7 derniers jours
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
}

export type CampaignWithStats = typeof campaigns.$inferSelect & {
  liveTotalLeads: number;
  liveCalledLeads: number;
  liveQualifiedLeads: number;
};

/**
 * Campagnes d'une organisation avec compteurs calculés en direct depuis la
 * table leads (les compteurs dénormalisés peuvent dériver).
 */
export async function getCampaignsWithStats(
  organizationId: string
): Promise<CampaignWithStats[]> {
  const rows = await db
    .select({
      campaign: campaigns,
      liveTotalLeads: sql<number>`count(${leads.id})::int`,
      liveCalledLeads: sql<number>`count(${leads.id}) filter (where ${leads.status} != 'new')::int`,
      liveQualifiedLeads: sql<number>`count(${leads.id}) filter (where ${leads.status} = 'qualified')::int`,
    })
    .from(campaigns)
    .leftJoin(leads, eq(leads.campaignId, campaigns.id))
    .where(eq(campaigns.organizationId, organizationId))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt));

  return rows.map((row) => ({
    ...row.campaign,
    liveTotalLeads: row.liveTotalLeads,
    liveCalledLeads: row.liveCalledLeads,
    liveQualifiedLeads: row.liveQualifiedLeads,
  }));
}

export type CampaignLeadStats = {
  total: number;
  newLeads: number;
  called: number;
  qualified: number;
  notInterested: number;
  callback: number;
  noAnswer: number;
};

/**
 * Statistiques agrégées des leads d'une campagne (tous les leads, pas
 * seulement la page affichée).
 */
export async function getCampaignLeadStats(
  campaignId: string
): Promise<CampaignLeadStats> {
  const result = await db
    .select({
      total: sql<number>`count(*)::int`,
      newLeads: sql<number>`count(*) filter (where ${leads.status} = 'new')::int`,
      called: sql<number>`count(*) filter (where ${leads.status} != 'new')::int`,
      qualified: sql<number>`count(*) filter (where ${leads.status} = 'qualified')::int`,
      notInterested: sql<number>`count(*) filter (where ${leads.status} = 'not_interested')::int`,
      callback: sql<number>`count(*) filter (where ${leads.status} = 'callback')::int`,
      noAnswer: sql<number>`count(*) filter (where ${leads.status} = 'no_answer')::int`,
    })
    .from(leads)
    .where(eq(leads.campaignId, campaignId));

  return (
    result[0] ?? {
      total: 0,
      newLeads: 0,
      called: 0,
      qualified: 0,
      notInterested: 0,
      callback: 0,
      noAnswer: 0,
    }
  );
}

export async function getWalletWithTransactions(organizationId: string) {
  const wallet = await db
    .select()
    .from(wallets)
    .where(eq(wallets.organizationId, organizationId))
    .limit(1);

  if (!wallet[0]) return null;

  const txHistory = await db
    .select()
    .from(transactions)
    .where(eq(transactions.walletId, wallet[0].id))
    .orderBy(desc(transactions.createdAt))
    .limit(20);

  return { wallet: wallet[0], transactions: txHistory };
}
