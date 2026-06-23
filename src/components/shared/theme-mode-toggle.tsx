"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted ? theme ?? resolvedTheme ?? "system" : "system";
  const nextTheme = current === "dark" ? "light" : current === "light" ? "system" : "dark";
  const label = current === "dark" ? "Mode sombre" : current === "light" ? "Mode clair" : "Mode automatique";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(nextTheme)}
      className="h-10 gap-2 rounded-full border-slate-200 bg-white/85 px-3 text-slate-800 shadow-sm hover:bg-violet-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
      title="Changer le mode clair / sombre"
    >
      {current === "dark" ? (
        <Moon className="h-4 w-4 text-violet-200" />
      ) : current === "light" ? (
        <Sun className="h-4 w-4 text-amber-500" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
      <span className="hidden text-xs font-medium sm:inline">{label}</span>
    </Button>
  );
}
