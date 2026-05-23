"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneCall, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "#features", label: "Fonctionnalités" },
  { href: "#how", label: "Comment ça marche" },
  { href: "#use-cases", label: "Cas d'usage" },
  { href: "#pricing", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed top-3 left-1/2 z-50 -translate-x-1/2 transition-all duration-500",
          "w-[calc(100%-1.5rem)] max-w-6xl rounded-full",
          scrolled
            ? "bg-slate-950/70 backdrop-blur-xl border border-white/10 shadow-2xl"
            : "bg-transparent border border-transparent"
        )}
      >
        <div className="flex items-center justify-between px-4 py-2.5 md:px-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">
              <PhoneCall className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">
              AfrivoiceAI
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-slate-300 hover:bg-white/5 hover:text-white sm:flex"
            >
              <Link href="/login">Connexion</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden bg-white text-slate-900 hover:bg-white/90 md:flex"
            >
              <Link href="/register">Commencer →</Link>
            </Button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-white md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 top-16 z-40 rounded-2xl border border-white/10 bg-slate-950/95 p-3 backdrop-blur-xl md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Link href="/login">Connexion</Link>
                </Button>
                <Button asChild size="sm" className="bg-white text-slate-900 hover:bg-white/90">
                  <Link href="/register">Commencer</Link>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
