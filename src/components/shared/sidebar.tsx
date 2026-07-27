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
  Headphones,
  RadioTower,
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
    title: "Démo vocale live",
    href: "/demo-vocale",
    icon: Headphones,
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
    title: "Lignes téléphoniques",
    href: "/phone-lines",
    icon: RadioTower,
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
    <div className="flex h-full flex-col border-r border-violet-300/20 bg-[linear-gradient(180deg,#080b18_0%,#11162a_46%,#07111b_100%)] text-white shadow-2xl shadow-black/40 backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-emerald-400 shadow-lg shadow-violet-950/30">
          <PhoneCall className="h-5 w-5 text-white" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#08090f] bg-emerald-300" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-base font-semibold tracking-[-0.03em] text-white">
            AfrivoxAI
          </span>
          <span className="truncate text-xs text-white/55 max-w-[160px]">
            {organizationName}
          </span>
        </div>
      </div>

      <Separator className="mx-2 my-2 bg-white/12" />

      <div className="px-2 py-2">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-violet-100/70">
          Espace plateforme
        </p>
        <div className="space-y-2 rounded-3xl border border-white/10 bg-white/[0.035] p-2">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
              pathname !== "/e-commerce"
                ? "bg-gradient-to-r from-emerald-300 to-violet-100 text-slate-950 font-semibold"
                : "text-white/75 hover:bg-white/10 hover:text-white"
            )}
          >
            <Megaphone className="h-4 w-4" />
            <span>Entreprises / prospection</span>
          </Link>
          <Link
            href="/e-commerce"
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
              pathname.startsWith("/e-commerce")
                ? "bg-gradient-to-r from-white to-violet-50 text-slate-950 font-semibold"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">E-commerce COD</span>
            <Badge variant="comingSoon" className="shrink-0 text-[10px]">
              Bientôt
            </Badge>
          </Link>
        </div>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-violet-100/70">
          Prospection entreprises
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
                  ? "bg-gradient-to-r from-white to-violet-50 text-slate-950 font-semibold shadow-lg shadow-violet-950/25"
                  : "text-slate-100/82 hover:bg-white/12 hover:text-white"
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
            <Separator className="my-3 bg-white/12" />
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-violet-100/70">
              Administration
            </p>
            {adminNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-r from-white to-violet-50 text-slate-950 font-semibold shadow-lg shadow-violet-950/25"
                      : "text-slate-100/82 hover:bg-white/12 hover:text-white"
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

        <Separator className="my-3 bg-white/12" />

        {/* Coming Soon */}
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-violet-100/70">
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
      <Separator className="mx-2 bg-white/12" />
      <div className="p-2">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 shadow-inner shadow-white/5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-white/20 to-white/5 text-xs font-semibold uppercase text-white">
            {userEmail.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-white/90">
              {userEmail}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-white/50 transition-colors hover:text-white"
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
