"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/utils";
import { ThemeModeToggle } from "@/components/shared/theme-mode-toggle";

interface HeaderProps {
  title: string;
  walletBalance: number;
  onMenuToggle?: () => void;
}

export function Header({ title, walletBalance, onMenuToggle }: HeaderProps) {
  const isLowBalance = walletBalance < 5000;

  return (
    <header className="mx-3 mt-3 flex h-16 items-center gap-3 rounded-3xl border border-violet-200/45 bg-slate-100/88 px-4 shadow-lg shadow-violet-100/35 backdrop-blur-2xl dark:border-white/10 dark:bg-[#101320]/92 dark:shadow-black/25 md:mx-5 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuToggle}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="flex-1 bg-gradient-to-r from-slate-950 via-violet-700 to-emerald-600 bg-clip-text text-lg font-semibold tracking-[-0.04em] text-transparent dark:from-white dark:via-violet-200 dark:to-emerald-200 md:text-xl">{title}</h1>

      <div className="flex items-center gap-3">
        <ThemeModeToggle />

        {/* Solde Wallet — cliquable vers la page wallet */}
        <Link
          href="/wallet"
          title="Voir le wallet"
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition hover:brightness-95 ${
            isLowBalance
              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          }`}
        >
          <span className="hidden sm:inline">Solde :</span>
          <span>{formatFcfa(walletBalance)}</span>
          {isLowBalance && (
            <Badge variant="warning" className="text-xs px-1">
              Faible
            </Badge>
          )}
        </Link>

        <Button asChild size="sm" className="hidden gap-1 rounded-full md:flex">
          <Link href="/campaigns">
            <Plus className="h-4 w-4" />
            Lancer un appel
          </Link>
        </Button>
      </div>
    </header>
  );
}
