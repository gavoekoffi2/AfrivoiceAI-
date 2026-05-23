"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardShellProps {
  organizationName: string;
  userEmail: string;
  walletBalance: number;
  lowBalanceThreshold?: number;
  children: React.ReactNode;
}

export function DashboardShell({
  organizationName,
  userEmail,
  walletBalance,
  lowBalanceThreshold,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-border md:flex md:flex-col">
        <Sidebar
          organizationName={organizationName}
          userEmail={userEmail}
        />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border md:hidden">
            <Sidebar
              organizationName={organizationName}
              userEmail={userEmail}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="AfrivoiceAI"
          walletBalance={walletBalance}
          lowBalanceThreshold={lowBalanceThreshold}
          onMenuToggle={() => setMobileOpen((v) => !v)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
