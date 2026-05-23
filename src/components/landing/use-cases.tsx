"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ShoppingBag, TrendingUp, Check, Quote } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";

const CASES = [
  {
    icon: ShoppingBag,
    eyebrow: "E-commerce · COD",
    title: "Vous perdez 30% de vos commandes paiement-à-la-livraison.",
    agitate:
      "Numéros injoignables, clients qui changent d'avis, refus à la livraison. Chaque commande non confirmée, c'est un produit immobilisé, une livraison perdue, et zéro revenu.",
    solution:
      "AfrivoiceAI rappelle automatiquement chaque client dès la commande passée. Confirmation, validation d'adresse, créneau de livraison. En moins d'une minute.",
    bullets: [
      "Taux de confirmation moyen : 87%",
      "Coût par commande confirmée : moins de 100 FCFA",
      "Intégrations natives Shopify & WooCommerce",
    ],
    image:
      "https://images.unsplash.com/photo-1615890932417-89da415105d2?w=800&q=85&auto=format&fit=crop",
    imageAlt: "Femme professionnelle au téléphone",
    accent: "emerald",
    quote: {
      text: "Avant, on devait embaucher trois personnes juste pour les confirmations. Aujourd'hui, on est passé à zéro — et le taux de livraison s'est même amélioré.",
      author: "Responsable e-commerce",
      role: "Boutique mode · 200 commandes/jour",
    },
  },
  {
    icon: TrendingUp,
    eyebrow: "Prospection B2B",
    title: "Vos commerciaux passent plus de temps au téléphone qu'à vendre.",
    agitate:
      "Pour chaque rendez-vous décroché, c'est 30 appels passés, 20 messageries laissées, et 10 refus polis. Un coût caché énorme — et l'équipe s'épuise sur les tâches répétitives.",
    solution:
      "Importez votre fichier de prospects. L'IA appelle, qualifie, prend des rendez-vous, et programme des rappels. Vos commerciaux ne voient que les leads qui valent la peine.",
    bullets: [
      "10× plus de leads contactés par jour",
      "Qualification structurée et notes automatiques",
      "Stop si la personne refuse — pas de harcèlement",
    ],
    image:
      "https://images.unsplash.com/photo-1573497019418-b400bb3ab074?w=800&q=85&auto=format&fit=crop",
    imageAlt: "Homme professionnel souriant",
    accent: "fuchsia",
    quote: {
      text: "On a doublé notre pipeline en six semaines. Et l'équipe commerciale ne fait plus que des appels où elle a déjà du contexte.",
      author: "Directeur commercial",
      role: "SaaS B2B · 12 commerciaux",
    },
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="relative bg-slate-950 py-24 md:py-32">
      <div className="container mx-auto max-w-7xl px-4">
        <FadeIn className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
            Cas d&apos;usage
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Deux problèmes coûteux.{" "}
            <span className="text-gradient-cool">Une seule solution.</span>
          </h2>
        </FadeIn>

        <div className="mt-16 space-y-24">
          {CASES.map((useCase, i) => {
            const isReverse = i % 2 === 1;
            return (
              <div
                key={useCase.eyebrow}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  isReverse ? "lg:[&>div:first-child]:order-2" : ""
                }`}
              >
                {/* Texte */}
                <motion.div
                  initial={{ opacity: 0, x: isReverse ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      useCase.accent === "emerald"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-fuchsia-500/10 text-fuchsia-300"
                    }`}
                  >
                    <useCase.icon className="h-3 w-3" />
                    {useCase.eyebrow}
                  </div>

                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                    {useCase.title}
                  </h3>

                  <p className="mt-4 text-base text-slate-400">
                    {useCase.agitate}
                  </p>
                  <p className="mt-3 text-base text-slate-300">
                    {useCase.solution}
                  </p>

                  <ul className="mt-6 space-y-2.5">
                    {useCase.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-3 text-sm text-slate-200"
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            useCase.accent === "emerald"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-fuchsia-500/15 text-fuchsia-300"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* Citation */}
                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <Quote
                      className={`h-5 w-5 ${
                        useCase.accent === "emerald"
                          ? "text-emerald-400"
                          : "text-fuchsia-400"
                      }`}
                    />
                    <p className="mt-3 text-sm italic text-slate-200">
                      « {useCase.quote.text} »
                    </p>
                    <p className="mt-3 text-xs font-medium text-slate-300">
                      {useCase.quote.author}{" "}
                      <span className="text-slate-500">— {useCase.quote.role}</span>
                    </p>
                  </div>
                </motion.div>

                {/* Image */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/10"
                >
                  <Image
                    src={useCase.image}
                    alt={useCase.imageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 500px"
                    className="object-cover"
                  />
                  <div
                    className={`absolute inset-0 ${
                      useCase.accent === "emerald"
                        ? "bg-gradient-to-tr from-emerald-900/40 via-transparent to-transparent"
                        : "bg-gradient-to-tr from-fuchsia-900/40 via-transparent to-transparent"
                    }`}
                  />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
