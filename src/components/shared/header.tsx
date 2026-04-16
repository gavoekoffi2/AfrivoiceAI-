"use client";

import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/utils";

interface HeaderProps {
  title: string;
  walletBalance: number;
  onMenuToggle?: () => void;
}

export function Header({ title, walletBalance, onMenuToggle }: HeaderProps) {
  const isLowBalance = walletBalance < 5000;

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="flex-1 text-lg font-semibold md:text-xl">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Solde Wallet */}
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
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
        </div>

        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
