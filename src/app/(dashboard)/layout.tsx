import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { getOrganizationStats } from "@/lib/db/queries";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const stats = await getOrganizationStats(session.organizationId);

  return (
    <DashboardShell
      organizationName={session.organizationName}
      userEmail={session.email}
      userRole={session.role}
      walletBalance={stats.walletBalance}
    >
      {children}
    </DashboardShell>
  );
}
