"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, PlayCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackground } from "@/components/motion/aurora-background";
import { PhoneMockup, PhoneBadge } from "./phone-mockup";

const headlineWords = ["Décrochez", "chaque", "vente.", "Sans", "décrocher."];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-slate-950 pb-32 pt-32 md:pt-36">
      <AuroraBackground intensity="default" />
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-50" />

      <div className="container relative mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-2 lg:items-center lg:gap-16">
        {/* Colonne gauche — texte */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex"
          >
            <PhoneBadge />
          </motion.div>

          <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {headlineWords.map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 0.7,
                  delay: 0.15 + i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={
                  word === "vente." || word === "décrocher."
                    ? "inline-block text-gradient-cool"
                    : "inline-block"
                }
              >
                {word}{i < headlineWords.length - 1 && " "}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mx-auto mt-6 max-w-xl text-balance text-base text-slate-300 sm:text-lg lg:mx-0"
          >
            Une intelligence artificielle vocale qui confirme vos commandes en{" "}
            <span className="font-semibold text-white">60 secondes</span>,
            qualifie vos prospects pendant que vous dormez, et parle un français
            naturel — pour un coût d&apos;une fraction d&apos;un agent humain.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.85 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
          >
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-full bg-white px-6 text-base text-slate-900 shadow-[0_0_0_4px_rgba(255,255,255,0.08)] hover:bg-white/90"
            >
              <Link href="/register">
                Commencer gratuitement
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 rounded-full border border-white/15 px-6 text-base text-white hover:bg-white/10"
            >
              <a href="#how">
                <PlayCircle className="mr-2 h-5 w-5" />
                Voir une démo (90s)
              </a>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="mt-8 flex flex-col items-center gap-4 text-xs text-slate-400 sm:flex-row sm:justify-center lg:justify-start"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Sans carte requise
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
              Premier crédit offert
            </span>
            <span className="hidden sm:inline">·</span>
            <span>Déploiement en 5 minutes</span>
          </motion.div>
        </div>

        {/* Colonne droite — visuel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative"
        >
          <PhoneMockup />
        </motion.div>
      </div>
    </section>
  );
}
