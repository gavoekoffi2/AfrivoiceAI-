"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingCart,
  Megaphone,
  Wallet,
  Settings,
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
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: "Commandes E-commerce",
    href: "/dashboard/e-commerce",
    icon: ShoppingCart,
  },
  {
    title: "Campagnes",
    href: "/dashboard/campaigns",
    icon: Megaphone,
  },
  {
    title: "Appels",
    href: "/dashboard/calls",
    icon: PhoneCall,
  },
  {
    title: "Wallet",
    href: "/dashboard/wallet",
    icon: Wallet,
  },
  {
    title: "Paramètres",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

const comingSoonItems = [
  {
    title: "Marketplace de Voix",
    icon: Mic2,
    description: "Voix africaines authentiques",
  },
  {
    title: "Clonage Vocal",
    icon: PhoneCall,
    description: "Clonez votre propre voix",
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
}

export function Sidebar({ organizationName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 pb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <PhoneCall className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-sidebar-foreground">
            AfrivoiceAI
          </span>
          <span className="text-xs text-sidebar-foreground/60 truncate max-w-[140px]">
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
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              {isActive &&
                (reduce ? (
                  <span className="absolute inset-0 rounded-lg bg-sidebar-accent" />
                ) : (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-sidebar-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ))}
              <item.icon className="relative z-10 h-4 w-4 shrink-0" />
              <span className="relative z-10">{item.title}</span>
              {isActive && (
                <ChevronRight className="relative z-10 ml-auto h-3 w-3 opacity-50" />
              )}
            </Link>
          );
        })}

        <Separator className="bg-sidebar-border my-3" />

        {/* Coming Soon */}
        <p className="px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40 mb-2">
          Bientôt disponible
        </p>
        {comingSoonItems.map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/40 cursor-not-allowed"
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
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase">
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
