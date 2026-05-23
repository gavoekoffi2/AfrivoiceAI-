"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Phone, Sparkles, ShieldCheck } from "lucide-react";
import { WaveformBars } from "@/components/motion/waveform-bars";

/**
 * Hero visual : un portrait + une fiche d'appel animée + un badge live.
 */
export function PhoneMockup() {
  return (
    <div className="relative h-[560px] w-full max-w-[520px] mx-auto">
      {/* Portrait principal */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
      >
        <Image
          src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=900&q=85&auto=format&fit=crop"
          alt="Professionnelle souriante au téléphone"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 520px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20" />
      </motion.div>

      {/* Badge "Appel en cours" en haut */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="absolute left-[-12px] top-8 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-2xl backdrop-blur"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Appel en direct · 02:14
      </motion.div>

      {/* Fiche en bas — transcription en direct */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.0 }}
        className="absolute -bottom-6 left-4 right-4 rounded-2xl border border-white/10 bg-slate-900/85 p-4 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Amina · Assistant IA</p>
              <p className="text-[11px] text-slate-400">
                Confirmation commande #4729
              </p>
            </div>
          </div>
          <WaveformBars
            bars={14}
            colorClass="bg-gradient-to-t from-purple-400 to-fuchsia-300"
            className="h-8"
          />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-200">
          « Bonjour, c&apos;est Amina. Je vous appelle pour confirmer votre
          commande de{" "}
          <span className="font-semibold text-fuchsia-300">42 000 FCFA</span>.
          Êtes-vous toujours disponible pour la livraison demain ? »
        </p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          Conversation chiffrée · Stockée 12 mois
        </div>
      </motion.div>

      {/* Bulle latérale "+1 commande confirmée" */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: 40 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 1.4 }}
        className="absolute -right-3 top-1/3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 shadow-xl backdrop-blur"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        +1 commande confirmée
      </motion.div>

      {/* Halo */}
      <div className="absolute inset-0 -z-10 translate-y-6 rounded-3xl bg-gradient-to-tr from-purple-600/40 to-fuchsia-500/40 blur-3xl" />
    </div>
  );
}

export function PhoneBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
      <Phone className="h-3 w-3 text-fuchsia-400" />
      Voice AI · Nouvelle génération
      <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
        BETA
      </span>
    </div>
  );
}
