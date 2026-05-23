"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Comment l'IA peut-elle parler français aussi naturellement ?",
    a: "Nous combinons trois technologies de pointe : une voix générée par ElevenLabs (synthèse ultra-réaliste), un modèle de langage Google Gemini pour la conversation, et un transcripteur Deepgram pour comprendre votre client. Le résultat : une voix indistinguable d'un humain, avec intonation, écoute active et hésitations naturelles.",
  },
  {
    q: "Combien ça me coûte concrètement ?",
    a: "Le coût moyen d'un appel d'une minute est d'environ 52 FCFA, marge incluse. Un appel de 3 minutes vous reviendra à ~156 FCFA. Vous voyez le coût exact de chaque appel dans votre dashboard, en temps réel. Pas d'abonnement, pas de minimum.",
  },
  {
    q: "Mes données et celles de mes clients sont-elles en sécurité ?",
    a: "Oui. Toutes les communications sont chiffrées (TLS 1.3 en transit, AES au repos). L'architecture multi-tenant isole strictement vos données de celles des autres organisations. Conformité RGPD. Les enregistrements sont conservés 12 mois maximum, sauf obligation légale.",
  },
  {
    q: "Quelles intégrations sont supportées ?",
    a: "Aujourd'hui : Shopify et WooCommerce pour les commandes COD via webhooks, Stripe pour la recharge wallet. La connexion se fait en moins de 5 minutes via une simple URL. Mobile Money (PayDunya, Wave, Flooz, TMoney) arrive très bientôt.",
  },
  {
    q: "Que se passe-t-il si l'IA tombe sur une messagerie vocale ?",
    a: "L'IA détecte automatiquement les messageries vocales et raccroche sans laisser de message. Vous voyez l'appel marqué comme « messagerie » dans votre dashboard, et vous pouvez programmer une nouvelle tentative manuellement ou laisser le système retenter automatiquement.",
  },
  {
    q: "Combien de temps faut-il pour configurer la plateforme ?",
    a: "Cinq minutes en moyenne : créez votre compte, copiez une URL webhook dans votre boutique Shopify/WooCommerce, rechargez votre wallet, et c'est parti. Pour la prospection, importez votre CSV de leads et lancez la campagne en un clic.",
  },
  {
    q: "Y a-t-il un engagement, un minimum ?",
    a: "Aucun. C'est du prépayé : vous rechargez ce que vous voulez, vous consommez à votre rythme. Si vous arrêtez d'utiliser la plateforme, vous ne payez rien.",
  },
  {
    q: "Puis-je personnaliser ce que dit l'IA ?",
    a: "Oui. Pour les campagnes de prospection, vous écrivez votre propre script (prompt). Pour les confirmations COD, vous personnalisez le nom de la boutique, l'identité vocale, le ton. L'IA s'adapte à votre marque.",
  },
];

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors",
        open
          ? "border-fuchsia-500/30 bg-white/[0.04]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-white sm:text-lg">{q}</span>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
            open
              ? "border-fuchsia-500/50 bg-fuchsia-500/20 text-fuchsia-300"
              : "border-white/15 bg-white/5 text-slate-400"
          )}
        >
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="px-5 pb-5 text-sm leading-relaxed text-slate-300">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative bg-slate-950 py-24 md:py-32">
      <div className="container mx-auto max-w-3xl px-4">
        <FadeIn className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
            Questions fréquentes
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Tout ce que vous voulez savoir.
          </h2>
        </FadeIn>

        <div className="mt-12 space-y-3">
          {FAQS.map((item, i) => (
            <FaqItem
              key={i}
              q={item.q}
              a={item.a}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
