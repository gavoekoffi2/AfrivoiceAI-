"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Sidebar } from "@/components/shared/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface DashboardShellProps {
  children: React.ReactNode;
  organizationName: string;
  userEmail: string;
  userRole: string;
  walletBalance: number;
}

export function DashboardShell({
  children,
  organizationName,
  userEmail,
  userRole,
  walletBalance,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border md:flex md:flex-col">
        <Sidebar
          organizationName={organizationName}
          userEmail={userEmail}
          userRole={userRole}
        />
      </aside>

      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="left-0 top-0 h-dvh max-w-[18rem] translate-x-0 translate-y-0 border-r p-0 sm:rounded-none data-[state=closed]:slide-out-to-left data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left data-[state=open]:slide-in-from-top-0">
          <DialogTitle className="sr-only">Menu de navigation AfrivoiceAI</DialogTitle>
          <DialogDescription className="sr-only">
            Navigation mobile du tableau de bord AfrivoiceAI.
          </DialogDescription>
          <Sidebar
            organizationName={organizationName}
            userEmail={userEmail}
            userRole={userRole}
          />
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="AfrivoiceAI"
          walletBalance={walletBalance}
          onMenuToggle={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
