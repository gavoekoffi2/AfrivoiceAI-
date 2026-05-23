"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

const TIERS = [
  {
    name: "Starter",
    description: "Pour tester sans engagement",
    price: "0",
    unit: "FCFA",
    sub: "à l'installation",
    cta: "Commencer gratuitement",
    href: "/register",
    featured: false,
    perks: [
      "Premier crédit offert (≈ 10 appels)",
      "Confirmation COD Shopify + WooCommerce",
      "Campagnes de prospection (limite 100 leads)",
      "Dashboard temps réel",
    ],
  },
  {
    name: "Pay-as-you-go",
    description: "Le plus populaire",
    price: "~52",
    unit: "FCFA",
    sub: "par minute d'appel",
    cta: "Créer mon compte",
    href: "/register",
    featured: true,
    perks: [
      "Appels illimités",
      "Multi-utilisateur (équipe)",
      "Webhooks dédiés par boutique",
      "Recharge par carte ou Mobile Money*",
      "Support prioritaire francophone",
    ],
  },
  {
    name: "Entreprise",
    description: "Volumes importants, SLA",
    price: "Sur mesure",
    unit: "",
    sub: "à partir de 500 000 FCFA/mois",
    cta: "Nous contacter",
    href: "/register",
    featured: false,
    perks: [
      "Tarif dégressif sur volume",
      "SLA garanti, support dédié",
      "Voix clonée (sur demande)",
      "Hébergement isolé, conformité",
      "Intégration sur mesure",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative bg-slate-950 py-24 md:py-32">
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
      <div className="container relative mx-auto max-w-7xl px-4">
        <FadeIn className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
            Tarification
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Simple. Transparente.{" "}
            <span className="text-gradient-cool">Sans abonnement.</span>
          </h2>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">
            Vous payez uniquement ce que vous consommez. Pas de minimum, pas
            d&apos;engagement. Voyez le coût exact de chaque appel.
          </p>
        </FadeIn>

        <div className="mx-auto mt-16 grid max-w-6xl gap-6 md:grid-cols-3">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={
                tier.featured
                  ? "relative rounded-3xl bg-gradient-to-b from-fuchsia-500/20 via-purple-500/10 to-transparent p-px"
                  : ""
              }
            >
              <div
                className={`relative h-full overflow-hidden rounded-[1.4rem] border p-7 ${
                  tier.featured
                    ? "border-fuchsia-500/30 bg-slate-950/95"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2 rounded-b-md bg-gradient-to-r from-purple-500 to-fuchsia-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Recommandé
                  </div>
                )}

                <h3 className="text-base font-semibold text-white">
                  {tier.name}
                </h3>
                <p className="mt-1 text-xs text-slate-400">{tier.description}</p>

                <div className="mt-6 flex items-end gap-1">
                  <span className="text-4xl font-bold text-white sm:text-5xl">
                    {tier.price}
                  </span>
                  {tier.unit && (
                    <span className="pb-1.5 text-base font-semibold text-slate-300">
                      {tier.unit}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{tier.sub}</p>

                <Button
                  asChild
                  size="lg"
                  className={`mt-6 w-full h-11 rounded-full ${
                    tier.featured
                      ? "bg-white text-slate-900 hover:bg-white/90"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  <Link href={tier.href}>
                    {tier.featured && <Sparkles className="mr-1 h-4 w-4" />}
                    {tier.cta}
                  </Link>
                </Button>

                <ul className="mt-7 space-y-3 text-sm">
                  {tier.perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-start gap-2.5 text-slate-300"
                    >
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          tier.featured ? "text-fuchsia-400" : "text-emerald-400"
                        }`}
                      />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          * Intégration Mobile Money (PayDunya, Wave, TMoney, Flooz) en cours de
          déploiement.
        </p>
      </div>
    </section>
  );
}
