"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PhoneCall, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Aurora } from "./aurora";

const HIGHLIGHTS = [
  "Confirmation des commandes COD par IA vocale",
  "Prospection B2B automatisée à grande échelle",
  "Paiement à l'usage en FCFA, sans abonnement",
];

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 shadow-glow">
        <PhoneCall className="h-5 w-5" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight text-white">
        Afrivoice<span className="text-amber-400">AI</span>
      </span>
    </Link>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="relative grid min-h-dvh bg-slate-950 font-sans text-slate-100 lg:grid-cols-2">
      {/* Panneau marque (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-10 lg:flex xl:p-14">
        <Aurora />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative">
          <h2 className="max-w-md text-balance font-display text-4xl font-bold leading-tight tracking-tight text-white">
            L&apos;IA vocale qui{" "}
            <span className="text-gradient-gold">confirme vos commandes</span>.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-3 text-slate-300">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-500">
          Conçu pour l&apos;Afrique · Français &amp; langues locales à venir
        </p>
      </aside>

      {/* Panneau formulaire */}
      <main className="relative flex items-center justify-center overflow-hidden p-6 sm:p-10">
        <Aurora className="lg:hidden [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md"
        >
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
          </div>

          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Retour à l&apos;accueil
          </Link>

          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-slate-400">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </motion.div>
      </main>
    </div>
  );
}
