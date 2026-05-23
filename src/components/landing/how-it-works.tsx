"use client";

import { motion } from "framer-motion";
import { Plug, Sparkles, BarChart3 } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";

const STEPS = [
  {
    n: "01",
    icon: Plug,
    title: "Branchez votre boutique ou votre CSV",
    description:
      "Une URL webhook Shopify/WooCommerce, ou un import CSV de leads. C'est tout. Pas de SDK à installer.",
    accent: "from-purple-500/40 to-fuchsia-500/40",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "L'IA appelle, parle, conclut",
    description:
      "Voix naturelle en français. Elle écoute, répond, prend des notes structurées et termine l'appel proprement.",
    accent: "from-fuchsia-500/40 to-pink-500/40",
  },
  {
    n: "03",
    icon: BarChart3,
    title: "Vous voyez les résultats",
    description:
      "Transcription, enregistrement, statut commande mis à jour, lead qualifié. Tout est dans votre dashboard.",
    accent: "from-pink-500/40 to-amber-500/40",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative bg-slate-950 py-24 md:py-32">
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      <div className="container relative mx-auto max-w-7xl px-4">
        <FadeIn className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
            Comment ça marche
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Trois étapes. <span className="text-gradient-cool">Cinq minutes.</span>
          </h2>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">
            Pas de formation, pas d&apos;intégration complexe. Vous configurez
            une fois, vous oubliez ensuite.
          </p>
        </FadeIn>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className="relative"
            >
              {/* Numéro géant en fond */}
              <span
                className={`pointer-events-none absolute -top-6 left-3 select-none text-[7rem] font-black leading-none text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.07)]`}
              >
                {step.n}
              </span>

              <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 md:p-8">
                <div
                  className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${step.accent} opacity-80`}
                />
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-lg">
                  <step.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {step.description}
                </p>

                {/* Connecteur entre les étapes (desktop only) */}
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-gradient-to-r from-white/30 to-transparent md:block"
                  />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
