import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  // Lecture allégée — uniquement ce dont le shell a besoin
  const [walletResult, orgResult] = await Promise.all([
    db
      .select({ balance: wallets.balanceFcfa })
      .from(wallets)
      .where(eq(wallets.organizationId, session.organizationId))
      .limit(1),
    db
      .select({ threshold: organizations.lowBalanceThresholdFcfa })
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1),
  ]);

  const walletBalance = parseFloat(walletResult[0]?.balance ?? "0");
  const lowBalanceThreshold = parseFloat(orgResult[0]?.threshold ?? "5000");

  return (
    <DashboardShell
      organizationName={session.organizationName}
      userEmail={session.email}
      walletBalance={walletBalance}
      lowBalanceThreshold={lowBalanceThreshold}
    >
      {children}
    </DashboardShell>
  );
}
