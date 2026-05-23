"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/motion/spotlight";

export function FinalCTA() {
  return (
    <section className="relative isolate overflow-hidden bg-slate-950 py-24 md:py-32">
      <Spotlight className="left-1/2 top-0 -translate-x-1/2 fill-fuchsia-500/20" />

      <div className="container relative mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-600/20 via-fuchsia-600/10 to-orange-500/10 p-px"
        >
          <div className="relative rounded-[2rem] bg-slate-950/90 p-10 sm:p-14 md:p-20">
            <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

            <div className="relative text-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur"
              >
                <Sparkles className="h-3 w-3 text-fuchsia-400" />
                Premier crédit offert · Sans carte requise
              </motion.div>

              <h2 className="mt-6 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-6xl">
                Votre prochain client.{" "}
                <span className="text-gradient-cool">
                  Appelé dans 60 secondes.
                </span>
              </h2>

              <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-slate-300 sm:text-lg">
                Créez votre compte. Connectez votre boutique. Voyez votre
                premier appel partir — et la première commande se confirmer.
                Tout, en moins de 10 minutes.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="group h-12 rounded-full bg-white px-7 text-base text-slate-900 shadow-[0_0_0_4px_rgba(255,255,255,0.1)] hover:bg-white/90"
                >
                  <Link href="/register">
                    Commencer maintenant
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="h-12 rounded-full border border-white/15 px-7 text-base text-white hover:bg-white/10"
                >
                  <Link href="/login">Se connecter</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Sans engagement
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-fuchsia-400" />
                  Configuré en 5 min
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Support francophone
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
