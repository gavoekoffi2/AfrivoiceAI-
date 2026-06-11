"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, PhoneCall, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#prospection", label: "Prospection B2B" },
  { href: "#ecommerce", label: "E-commerce" },
  { href: "#fonctionnement", label: "Comment ça marche" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-white/10 bg-slate-950/80 backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-amber-500">
            <PhoneCall className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">
            Afrivoice<span className="text-violet-400">AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-slate-300 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Button asChild className="bg-violet-600 hover:bg-violet-500">
              <Link href="/dashboard">Accéder au dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">Connexion</Link>
              </Button>
              <Button asChild className="bg-violet-600 hover:bg-violet-500">
                <Link href="/register">Démarrer gratuitement</Link>
              </Button>
            </>
          )}
        </div>

        {/* Burger mobile */}
        <button
          className="text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Menu mobile */}
      {open && (
        <div className="border-b border-white/10 bg-slate-950/95 px-4 pb-6 pt-2 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm text-slate-300 hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {isAuthenticated ? (
                <Button asChild className="bg-violet-600 hover:bg-violet-500">
                  <Link href="/dashboard">Accéder au dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild className="bg-violet-600 hover:bg-violet-500">
                    <Link href="/register">Démarrer gratuitement</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    <Link href="/login">Connexion</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
