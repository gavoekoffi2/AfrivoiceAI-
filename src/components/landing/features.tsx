"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  Megaphone,
  Wallet,
  Globe2,
  ShieldCheck,
  Zap,
  ArrowRight,
} from "lucide-react";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion/fade-in";
import { WaveformBars } from "@/components/motion/waveform-bars";
import { cn } from "@/lib/utils";

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <FadeIn className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-balance text-base text-slate-400 sm:text-lg">
          {subtitle}
        </p>
      )}
    </FadeIn>
  );
}

function BentoCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "card-glow relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 backdrop-blur-sm md:p-8",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function Features() {
  return (
    <section id="features" className="relative bg-slate-950 py-24 md:py-32">
      <div className="container mx-auto max-w-7xl px-4">
        <SectionHeading
          eyebrow="Tout ce dont vous avez besoin"
          title={
            <>
              Une plateforme.{" "}
              <span className="text-gradient-cool">Mille appels.</span> Zéro
              embauche.
            </>
          }
          subtitle="Confirmation, prospection, suivi — tout est automatisé par une IA qui parle, écoute et apprend de chaque conversation."
        />

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5">
          {/* Card 1 : Hero feature — Confirmation COD */}
          <BentoCard className="md:col-span-4 md:row-span-2" delay={0.05}>
            <div className="grid h-full gap-6 sm:grid-cols-2 sm:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <ShoppingBag className="h-3 w-3" />
                  E-commerce
                </div>
                <h3 className="mt-4 text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Vos commandes COD confirmées en{" "}
                  <span className="text-gradient-cool">60 secondes</span>
                </h3>
                <p className="mt-3 text-sm text-slate-400">
                  Chaque commande Shopify ou WooCommerce déclenche un appel IA
                  immédiat. Le client confirme, l&apos;adresse est validée, le
                  créneau de livraison est noté — sans intervention humaine.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {[
                    "Détection automatique des paiements à la livraison",
                    "Transcription et résumé de chaque appel",
                    "Statut commande synchronisé en temps réel",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative h-64 overflow-hidden rounded-2xl sm:h-full sm:min-h-[280px]">
                <Image
                  src="https://images.unsplash.com/photo-1758876202167-f81c995c3fdc?w=800&q=85&auto=format&fit=crop"
                  alt="Professionnelle en appel"
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/70 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-slate-950/80 p-3 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">
                        Commande #4729 confirmée
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Livraison demain, 14h-16h
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      ✓ Validé
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card 2 : Prospection */}
          <BentoCard className="md:col-span-2" delay={0.1}>
            <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
              <Megaphone className="h-3 w-3" />
              Prospection
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              Vos leads, appelés pendant que vous dormez
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Importez un CSV. L&apos;IA s&apos;occupe du reste. Qualification,
              prise de rendez-vous, ou rappel programmé.
            </p>

            <div className="mt-4 space-y-2">
              {[
                { name: "Marie A.", status: "Qualifié", color: "emerald" },
                { name: "Koffi T.", status: "Rappel demain", color: "blue" },
                { name: "Aïcha B.", status: "Qualifié", color: "emerald" },
              ].map((lead, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-200">{lead.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      lead.color === "emerald"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-blue-500/15 text-blue-300"
                    )}
                  >
                    {lead.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </BentoCard>

          {/* Card 3 : Voix réaliste */}
          <BentoCard className="md:col-span-2" delay={0.15}>
            <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-300">
              <Zap className="h-3 w-3" />
              Voix réaliste
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              On ne dirait pas une IA.
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Voix naturelle en français, intonation, hésitations, écoute active.
              Vos clients pensent parler à un humain.
            </p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300">
                  Démo voix — 8s
                </span>
                <WaveformBars
                  bars={20}
                  colorClass="bg-gradient-to-t from-fuchsia-400 to-purple-300"
                />
              </div>
            </div>
          </BentoCard>

          {/* Card 4 : Wallet */}
          <BentoCard className="md:col-span-2" delay={0.2}>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              <Wallet className="h-3 w-3" />
              Sans abonnement
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              Vous payez à l&apos;appel.
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Recharge prépayée en FCFA. Pas d&apos;abonnement, pas
              d&apos;engagement. Voyez le coût exact de chaque conversation.
            </p>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Coût moyen
                </p>
                <p className="text-3xl font-bold text-white">~52 FCFA</p>
                <p className="text-[11px] text-slate-500">par minute d&apos;appel</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Marge transparente
                </p>
                <p className="text-lg font-semibold text-emerald-300">+30%</p>
              </div>
            </div>
          </BentoCard>

          {/* Card 5 : Sécurité */}
          <BentoCard className="md:col-span-2" delay={0.25}>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              <ShieldCheck className="h-3 w-3" />
              Sécurité enterprise
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              Isolation stricte, données chiffrées.
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Multi-tenant by design. Conforme RGPD. Vos appels et vos clients
              ne sortent jamais de votre périmètre.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {["HMAC", "RGPD", "TLS 1.3", "SOC-ready"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-[11px] font-medium text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </BentoCard>

          {/* Card 6 : Langues */}
          <BentoCard className="md:col-span-2" delay={0.3}>
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <Globe2 className="h-3 w-3" />
              Bientôt
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              Plusieurs langues. Le même prix.
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Français natif aujourd&apos;hui. Anglais, Éwé, Wolof, Fon, Twi,
              Haoussa arrivent.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["🇫🇷 Français", "🇬🇧 English", "🇹🇬 Éwé", "🇸🇳 Wolof", "🇧🇯 Fon"].map(
                (lang) => (
                  <span
                    key={lang}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300"
                  >
                    {lang}
                  </span>
                )
              )}
            </div>
          </BentoCard>
        </div>

        <StaggerGroup
          className="mt-16 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400"
          delayChildren={0.2}
        >
          <StaggerItem>
            <a
              href="#how"
              className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-white transition-colors hover:bg-white/10"
            >
              Voir comment ça marche
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </StaggerItem>
        </StaggerGroup>
      </div>
    </section>
  );
}
