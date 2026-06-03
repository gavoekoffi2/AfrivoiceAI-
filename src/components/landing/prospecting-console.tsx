"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Megaphone, Phone, Check, Clock3, X, Users } from "lucide-react";

type Outcome = "qualified" | "callback" | "declined";

const LEADS: { name: string; company: string; outcome: Outcome }[] = [
  { name: "Koffi Adjévi", company: "Lomé Digital", outcome: "qualified" },
  { name: "Awa Diallo", company: "Sahel Retail", outcome: "callback" },
  { name: "Yao Mensah", company: "Atlantic Logistics", outcome: "qualified" },
  { name: "Fatou Sow", company: "Dakar Foods", outcome: "declined" },
  { name: "Komla Etsé", company: "Kara Mobile", outcome: "qualified" },
];

const OUTCOME = {
  qualified: {
    label: "Qualifié",
    cls: "text-emerald-300 bg-emerald-500/15 ring-emerald-400/30",
    Icon: Check,
  },
  callback: {
    label: "À rappeler",
    cls: "text-amber-300 bg-amber-500/15 ring-amber-400/30",
    Icon: Clock3,
  },
  declined: {
    label: "Pas intéressé",
    cls: "text-slate-400 bg-white/[0.05] ring-white/10",
    Icon: X,
  },
} as const;

const STEP_MS = 1700;
const START_MS = 600;

function MiniWave() {
  return (
    <div className="flex h-4 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[2.5px] origin-bottom rounded-full bg-amber-400 animate-sound-bar"
          style={{ height: "100%", animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

/**
 * Console de campagne de prospection animée — visuel principal du hero.
 * L'IA "appelle" chaque lead en boucle, les qualifie, la barre de progression
 * se remplit et le compteur de leads qualifiés s'incrémente. Auto-joué, en
 * boucle, immédiatement visible. Statique si prefers-reduced-motion.
 */
export function ProspectingConsole() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(reduce ? LEADS.length : 0);

  useEffect(() => {
    if (reduce) {
      setActive(LEADS.length);
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setActive(0);
      for (let i = 1; i <= LEADS.length; i++) {
        timers.push(
          setTimeout(() => !cancelled && setActive(i), START_MS + i * STEP_MS)
        );
      }
      // Pause sur la campagne terminée, puis on relance.
      timers.push(
        setTimeout(
          () => !cancelled && run(),
          START_MS + (LEADS.length + 2) * STEP_MS
        )
      );
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduce]);

  const qualified = LEADS.slice(0, active).filter(
    (l) => l.outcome === "qualified"
  ).length;
  const progress = active / LEADS.length;

  return (
    <div className="relative w-full max-w-md">
      {/* Halo */}
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-500/30 via-transparent to-violet-600/20 blur-2xl" />

      <div className="glass overflow-hidden rounded-[1.75rem] shadow-2xl">
        {/* En-tête campagne */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              Campagne · Prospection B2B
            </p>
            <p className="flex items-center gap-1.5 text-xs text-emerald-300">
              <span className="inline-block h-1.5 w-1.5 animate-glow-pulse rounded-full bg-emerald-400" />
              En cours · {LEADS.length} leads en file
            </p>
          </div>
          <MiniWave />
        </div>

        {/* Progression + compteurs */}
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Leads contactés</span>
            <span className="font-semibold tabular-nums text-white">
              {active}/{LEADS.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full w-full origin-left rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
              animate={{ scaleX: progress || 0.001 }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={qualified}
                  initial={reduce ? false : { y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 6, opacity: 0 }}
                  className="font-semibold tabular-nums"
                >
                  {qualified}
                </motion.span>
              </AnimatePresence>
              qualifiés
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Users className="h-3.5 w-3.5" /> 8 appels simultanés
            </span>
          </div>
        </div>

        {/* Liste de leads */}
        <div className="flex flex-col gap-2 px-3 py-3">
          {LEADS.map((lead, i) => {
            const state =
              i < active ? "done" : i === active ? "calling" : "queued";
            const meta = OUTCOME[lead.outcome];
            return (
              <motion.div
                key={lead.name}
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: state === "queued" ? 0.5 : 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition-colors ${
                  state === "calling"
                    ? "bg-amber-500/[0.08] ring-amber-400/30"
                    : "bg-white/[0.02] ring-white/5"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    state === "calling"
                      ? "bg-amber-500/20 text-amber-200"
                      : "bg-white/5 text-slate-300"
                  }`}
                >
                  {lead.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {lead.name}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {lead.company}
                  </p>
                </div>
                <div className="shrink-0">
                  <AnimatePresence mode="wait">
                    {state === "calling" ? (
                      <motion.span
                        key="call"
                        initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/30"
                      >
                        <Phone className="h-3 w-3 animate-glow-pulse" /> Appel…
                      </motion.span>
                    ) : state === "done" ? (
                      <motion.span
                        key="done"
                        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.cls}`}
                      >
                        <meta.Icon className="h-3 w-3" /> {meta.label}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="queue"
                        initial={false}
                        className="inline-flex rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-white/10"
                      >
                        En file
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Badge flottant */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute -right-3 -top-3 hidden items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/10 backdrop-blur sm:flex"
      >
        <Megaphone className="h-3.5 w-3.5 text-amber-400" /> Campagne en direct
      </motion.div>
    </div>
  );
}
