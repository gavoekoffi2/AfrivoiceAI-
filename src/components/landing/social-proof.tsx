"use client";

import { motion } from "framer-motion";
import { Marquee } from "@/components/motion/marquee";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { FadeIn } from "@/components/motion/fade-in";

const PROOF_LOGOS = [
  "Shopify",
  "WooCommerce",
  "Vapi",
  "ElevenLabs",
  "Gemini",
  "Stripe",
  "Supabase",
  "Next.js",
];

const STATS = [
  {
    value: 1_400_000,
    suffix: "+",
    label: "appels traités",
    sub: "depuis le lancement",
  },
  {
    value: 87,
    suffix: "%",
    label: "taux de confirmation",
    sub: "commandes COD",
  },
  {
    value: 24,
    suffix: "/7",
    label: "disponibilité",
    sub: "aucun jour férié",
  },
  {
    value: 62,
    suffix: "s",
    label: "appel moyen",
    sub: "rapide et efficace",
  },
];

export function SocialProof() {
  return (
    <section className="relative border-y border-white/5 bg-slate-950 py-16">
      <div className="container mx-auto max-w-7xl px-4">
        <FadeIn className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
            Construit sur les meilleures briques du marché
          </p>
        </FadeIn>

        <div className="mt-8">
          <Marquee durationSec={32} className="text-slate-400">
            {PROOF_LOGOS.map((logo) => (
              <span
                key={logo}
                className="mx-8 select-none whitespace-nowrap text-xl font-semibold tracking-tight text-slate-500 transition-colors hover:text-slate-300"
              >
                {logo}
              </span>
            ))}
          </Marquee>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-center backdrop-blur"
            >
              <div className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                <AnimatedCounter
                  to={stat.value}
                  suffix={stat.suffix}
                  duration={1.6}
                />
              </div>
              <p className="mt-2 text-sm font-medium text-slate-200">
                {stat.label}
              </p>
              <p className="text-xs text-slate-500">{stat.sub}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
