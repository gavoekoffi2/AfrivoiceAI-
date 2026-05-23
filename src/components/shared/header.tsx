"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  title: string;
  walletBalance: number;
  lowBalanceThreshold?: number;
  onMenuToggle?: () => void;
}

export function Header({
  title,
  walletBalance,
  lowBalanceThreshold = 5000,
  onMenuToggle,
}: HeaderProps) {
  const isLowBalance = walletBalance < lowBalanceThreshold;

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6 sticky top-0 z-30">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuToggle}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="flex-1 text-lg font-semibold md:text-xl truncate">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/wallet"
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            isLowBalance
              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200"
              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200"
          }`}
          title="Voir le wallet"
        >
          <span className="hidden sm:inline">Solde :</span>
          <span>{formatFcfa(walletBalance)}</span>
          {isLowBalance && (
            <Badge variant="warning" className="text-xs px-1">
              Faible
            </Badge>
          )}
        </Link>

        <ThemeToggle />
      </div>
    </header>
  );
}
