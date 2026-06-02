"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  PhoneCall,
  Check,
  ShieldCheck,
  MapPin,
  ShoppingBag,
} from "lucide-react";

type Speaker = "ai" | "client";
const SCRIPT: { from: Speaker; text: string }[] = [
  { from: "ai", text: "Bonjour Awa, c'est Amina de la boutique Kossi Mode. Je vous appelle pour confirmer votre commande." },
  { from: "client", text: "Oui bonjour, c'est bien moi." },
  { from: "ai", text: "Votre commande de 24 900 FCFA, livrée à Lomé (Tokoin). C'est correct ?" },
  { from: "client", text: "Oui c'est exact, je serai disponible demain." },
  { from: "ai", text: "Parfait, votre commande est confirmée. Livraison demain. Excellente journée !" },
];

const STEP_MS = 1500;
const START_MS = 700;

function Waveform() {
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-amber-400 animate-sound-bar"
          style={{ height: "100%", animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function CallMockup() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(reduce ? SCRIPT.length : 0);
  const [confirmed, setConfirmed] = useState(reduce);

  useEffect(() => {
    if (reduce) {
      setVisible(SCRIPT.length);
      setConfirmed(true);
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setVisible(0);
      setConfirmed(false);
      SCRIPT.forEach((_, i) => {
        timers.push(
          setTimeout(() => !cancelled && setVisible(i + 1), START_MS + i * STEP_MS)
        );
      });
      const confirmAt = START_MS + SCRIPT.length * STEP_MS + 300;
      timers.push(setTimeout(() => !cancelled && setConfirmed(true), confirmAt));
      timers.push(setTimeout(() => !cancelled && run(), confirmAt + 3400));
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduce]);

  return (
    <div className="relative w-full max-w-md">
      {/* Halo */}
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-amber-500/30 via-transparent to-violet-600/20 blur-2xl" />

      <div className="glass overflow-hidden rounded-[1.75rem] shadow-2xl">
        {/* En-tête appel */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900">
              <PhoneCall className="h-5 w-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              Amina · Assistant IA
            </p>
            <p className="flex items-center gap-1.5 text-xs text-emerald-300">
              <span className="inline-block h-1.5 w-1.5 animate-glow-pulse rounded-full bg-emerald-400" />
              Appel en cours
            </p>
          </div>
          <Waveform />
        </div>

        {/* Conversation */}
        <div className="flex min-h-[19rem] flex-col gap-3 px-5 py-5">
          {SCRIPT.slice(0, visible).map((m, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className={`flex ${m.from === "ai" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.from === "ai"
                    ? "rounded-tl-sm bg-white/[0.06] text-slate-100"
                    : "rounded-tr-sm bg-amber-500/15 text-amber-50"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Carte commande + statut */}
        <div className="border-t border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Commande #4821</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3 w-3" /> Lomé · 24 900 FCFA
                </p>
              </div>
            </div>
            <AnimatePresence mode="wait">
              {confirmed ? (
                <motion.span
                  key="ok"
                  initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30"
                >
                  <Check className="h-3.5 w-3.5" /> Confirmée
                </motion.span>
              ) : (
                <motion.span
                  key="wait"
                  initial={false}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20"
                >
                  <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full bg-amber-400" />
                  En cours…
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Badge flottant */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute -right-3 -top-3 hidden items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/10 backdrop-blur sm:flex"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> 100 % automatique
      </motion.div>
    </div>
  );
}
