import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { getOrganizationStats } from "@/lib/db/queries";
import { Sidebar } from "@/components/shared/sidebar";
import { Header } from "@/components/shared/header";

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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - masquée sur mobile, visible sur desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-border md:flex md:flex-col">
        <Sidebar
          organizationName={session.organizationName}
          userEmail={session.email}
        />
      </aside>

      {/* Contenu principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="AfrivoiceAI"
          walletBalance={stats.walletBalance}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
