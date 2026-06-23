"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Megaphone,
  Database,
  Wallet,
  Settings,
  ShieldCheck,
  PhoneCall,
  Mic2,
  Globe,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/app/actions/auth";

const mainNavItems = [
  {
    title: "Vue d'ensemble",
    href: "/",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Commandes E-commerce",
    href: "/e-commerce",
    icon: ShoppingCart,
  },
  {
    title: "Campagnes",
    href: "/campaigns",
    icon: Megaphone,
  },
  {
    title: "Bases prospects",
    href: "/lead-databases",
    icon: Database,
  },
  {
    title: "Appels",
    href: "/calls",
    icon: PhoneCall,
  },
  {
    title: "Voix africaines",
    href: "/african-voices",
    icon: Mic2,
  },
  {
    title: "Clonage voix",
    href: "/voice-cloning",
    icon: Mic2,
  },
  {
    title: "Wallet",
    href: "/wallet",
    icon: Wallet,
  },
  {
    title: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

const adminNavItems = [
  {
    title: "Super administration",
    href: "/admin",
    icon: ShieldCheck,
  },
];

const comingSoonItems = [
  {
    title: "Marketplace de Voix",
    icon: Mic2,
    description: "Voix africaines authentiques",
  },
  {
    title: "Langues Locales",
    icon: Globe,
    description: "Éwé, Wolof, Fon...",
  },
];

interface SidebarProps {
  organizationName: string;
  userEmail: string;
  userRole: string;
}

export function Sidebar({ organizationName, userEmail, userRole }: SidebarProps) {
  const pathname = usePathname();
  const showAdmin = userRole === "super_admin" || userRole === "admin";

  return (
    <div className="flex h-full flex-col border-r border-white/10 bg-[#08090f]/88 text-white shadow-2xl shadow-black/30 backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-emerald-400 shadow-lg shadow-violet-950/30">
          <PhoneCall className="h-5 w-5 text-white" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#08090f] bg-emerald-300" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-base font-semibold tracking-[-0.03em] text-white">
            AfrivoiceAI
          </span>
          <span className="truncate text-xs text-white/55 max-w-[160px]">
            {organizationName}
          </span>
        </div>
      </div>

      <Separator className="bg-sidebar-border mx-2 my-2" />

      {/* Navigation principale */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        <p className="px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40 mb-2">
          Navigation
        </p>
        {mainNavItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
                isActive
                  ? "bg-white text-slate-950 font-semibold shadow-lg shadow-violet-950/20"
                  : "text-white/62 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
              {isActive && (
                <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
              )}
            </Link>
          );
        })}

        {showAdmin && (
          <>
            <Separator className="bg-sidebar-border my-3" />
            <p className="px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40 mb-2">
              Administration
            </p>
            {adminNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                  {isActive && (
                    <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
                  )}
                </Link>
              );
            })}
          </>
        )}

        <Separator className="bg-sidebar-border my-3" />

        {/* Coming Soon */}
        <p className="px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40 mb-2">
          Bientôt disponible
        </p>
        {comingSoonItems.map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-3 py-2.5 text-sm text-white/35 cursor-not-allowed"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="truncate">{item.title}</span>
              <span className="text-xs truncate">{item.description}</span>
            </div>
            <Badge variant="comingSoon" className="ml-auto shrink-0 text-xs px-1.5">
              Bientôt
            </Badge>
          </div>
        ))}
      </nav>

      {/* Footer - User */}
      <Separator className="bg-sidebar-border mx-2" />
      <div className="p-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 shadow-inner shadow-white/5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-white/20 to-white/5 text-xs font-semibold uppercase text-white">
            {userEmail.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {userEmail}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
