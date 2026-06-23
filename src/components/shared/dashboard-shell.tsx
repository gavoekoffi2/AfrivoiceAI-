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
    <div className="relative flex h-screen overflow-hidden bg-[#eef1fb] text-slate-950 dark:bg-[#07080d] dark:text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-[-18rem] h-[34rem] w-[34rem] rounded-full bg-violet-400/20 blur-3xl animate-premium-orb" />
        <div className="absolute right-[-16rem] top-32 h-[30rem] w-[30rem] rounded-full bg-emerald-300/16 blur-3xl animate-premium-orb-delayed" />
        <div className="absolute bottom-[-18rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-sky-300/14 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.045)_1px,transparent_1px)] bg-[size:46px_46px] [mask-image:radial-gradient(circle_at_top,black,transparent_72%)]" />
      </div>
      <aside className="relative z-10 hidden w-64 shrink-0 border-r border-white/10 md:flex md:flex-col">
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

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <Header
          title="AfrivoiceAI"
          walletBalance={walletBalance}
          onMenuToggle={() => setMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto px-0 pb-6">{children}</main>
      </div>
    </div>
  );
}
