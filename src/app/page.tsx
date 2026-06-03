import Link from "next/link";
import {
  ArrowRight,
  PhoneCall,
  ShoppingCart,
  Megaphone,
  Wallet,
  FileText,
  Languages,
  ShieldCheck,
  Sparkles,
  Plug,
  Clock,
  TrendingDown,
  PhoneOff,
  CheckCircle2,
  BarChart3,
  Headphones,
  Store,
  Building2,
  Rocket,
  Heart,
} from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { Aurora } from "@/components/landing/aurora";
import { ParticleField } from "@/components/landing/particle-field";
import { CallMockup } from "@/components/landing/call-mockup";
import { ProspectingConsole } from "@/components/landing/prospecting-console";
import { Reveal } from "@/components/landing/reveal";
import { StatCounter } from "@/components/landing/stat-counter";
import {
  ScrollProgress,
  Magnetic,
  PointerParallax,
} from "@/components/landing/motion-fx";

const INTEGRATIONS = [
  "Shopify",
  "WooCommerce",
  "Vapi",
  "ElevenLabs",
  "Google Gemini",
  "Deepgram",
];

const FEATURES = [
  {
    icon: Megaphone,
    title: "Prospection téléphonique B2B",
    desc: "Importez vos leads (CSV), définissez un script, et lancez des campagnes d'appels sortants. L'IA appelle, qualifie et relance des centaines de prospects en parallèle.",
    tint: "text-violet-300 bg-violet-500/10 ring-violet-400/20",
  },
  {
    icon: FileText,
    title: "Qualification & résumé IA",
    desc: "Chaque appel est enregistré, transcrit et résumé. Vous récupérez l'intérêt, les objections et les rendez-vous, prêts à exploiter.",
    tint: "text-sky-300 bg-sky-500/10 ring-sky-400/20",
  },
  {
    icon: BarChart3,
    title: "Issue d'appel fiable",
    desc: "Une analyse déterministe classe chaque appel : qualifié, à rappeler ou pas intéressé. Vos commerciaux ne traitent que les leads chauds.",
    tint: "text-rose-300 bg-rose-500/10 ring-rose-400/20",
  },
  {
    icon: ShoppingCart,
    title: "Confirmation COD (bonus)",
    desc: "Aussi en e-commerce : chaque commande Shopify/WooCommerce déclenche un appel IA qui confirme l'achat, l'adresse et le créneau de livraison.",
    tint: "text-amber-400 bg-amber-500/10 ring-amber-400/20",
  },
  {
    icon: Wallet,
    title: "Wallet en FCFA",
    desc: "Pas d'abonnement. Vous rechargez votre solde et payez à l'usage, à la seconde près, avec une tarification transparente.",
    tint: "text-emerald-300 bg-emerald-500/10 ring-emerald-400/20",
  },
  {
    icon: Languages,
    title: "Français + langues locales",
    desc: "Des appels naturels en français aujourd'hui — Éwé, Wolof, Fon et d'autres voix africaines authentiques arrivent.",
    tint: "text-amber-300 bg-amber-500/10 ring-amber-400/20",
  },
];

const STEPS = [
  {
    icon: Plug,
    title: "1 · Importez vos leads",
    desc: "Chargez votre liste de prospects (CSV) et choisissez le script d'appel. Aucune ligne de code.",
  },
  {
    icon: PhoneCall,
    title: "2 · L'IA lance les appels",
    desc: "Amina appelle vos prospects en parallèle, présente votre offre, répond aux questions et qualifie l'intérêt.",
  },
  {
    icon: CheckCircle2,
    title: "3 · Récupérez les leads chauds",
    desc: "Statut, transcription et résumé en temps réel. Vos commerciaux se concentrent sur les prospects qualifiés.",
  },
];

const PERSONAS = [
  {
    icon: Building2,
    title: "PME & équipes commerciales",
    desc: "Qualifiez des centaines de prospects par IA et concentrez vos commerciaux sur les leads réellement chauds.",
  },
  {
    icon: Headphones,
    title: "Agences & centres d'appels",
    desc: "Démultipliez vos campagnes sortantes, gérez plusieurs comptes et facturez la valeur à vos clients.",
  },
  {
    icon: Store,
    title: "E-commerçants COD",
    desc: "En bonus, confirmez chaque commande en paiement à la livraison avant l'expédition pour réduire les retours.",
  },
];

const FAQ = [
  {
    q: "Faut-il un abonnement ?",
    a: "Non. AfrivoiceAI fonctionne au paiement à l'usage : vous rechargez votre wallet en FCFA et chaque appel est débité à la seconde, marge incluse. Vous gardez le contrôle total de votre budget.",
  },
  {
    q: "Dans quelles langues l'IA appelle-t-elle ?",
    a: "En français naturel dès aujourd'hui. Le support des langues locales (Éwé, Wolof, Fon, Dioula…) avec des voix africaines authentiques est sur notre feuille de route.",
  },
  {
    q: "Avec quels outils est-ce compatible ?",
    a: "Un simple import CSV pour la prospection, et Shopify / WooCommerce pour l'e-commerce (via webhooks). La voix et la conversation s'appuient sur Vapi, ElevenLabs, Deepgram et Google Gemini.",
  },
  {
    q: "Comment l'IA qualifie-t-elle un prospect ?",
    a: "Chaque appel est analysé de façon structurée et classé : « qualifié », « à rappeler » ou « pas intéressé », avec un résumé et les objections. Vos commerciaux ne rappellent que les leads chauds. En e-commerce, le même moteur confirme ou non les commandes COD.",
  },
  {
    q: "Mes données sont-elles en sécurité ?",
    a: "Chaque organisation est isolée (multi-tenant), les webhooks sont signés et vérifiés, et les accès sont protégés. Vous restez propriétaire de vos données clients.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: React.ReactNode;
  desc?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-300">
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="mt-5 text-balance font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          {title}
        </h2>
      </Reveal>
      {desc && (
        <Reveal delay={0.1}>
          <p className="mt-4 text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
            {desc}
          </p>
        </Reveal>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-950 font-sans text-slate-100 selection:bg-amber-400/30">
      <ScrollProgress />
      <LandingNav />

      {/* ============================= HERO ============================= */}
      <section className="relative isolate pt-32 pb-20 sm:pt-40 sm:pb-28">
        <Aurora className="-z-10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <ParticleField className="-z-10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8">
          {/* Colonne texte */}
          <div className="text-center lg:text-left">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Prospection téléphonique B2B · IA vocale
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-6 text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[4.2rem]">
                L&apos;IA vocale qui{" "}
                <span className="text-gradient-brand animate-gradient-x">
                  prospecte vos clients
                </span>{" "}
                pendant que vous vendez.
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-slate-300 lg:mx-0">
                Lancez des campagnes d&apos;appels sortants : votre assistant
                vocal appelle, qualifie et relance vos prospects B2B en continu —
                et confirme aussi vos commandes COD. Facturé en FCFA, sans
                abonnement.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Magnetic className="w-full sm:w-auto">
                  <Link
                    href="/register"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-base font-semibold text-slate-950 shadow-glow transition-all hover:bg-amber-400 sm:w-auto"
                  >
                    Commencer gratuitement
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Magnetic>
                <Magnetic className="w-full sm:w-auto">
                  <a
                    href="#demo"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/[0.07] sm:w-auto"
                  >
                    <PhoneCall className="h-5 w-5 text-amber-400" />
                    Voir la démo
                  </a>
                </Magnetic>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400 lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sans
                  carte bancaire
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Import CSV
                  de leads
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Paiement
                  à l&apos;usage
                </span>
              </div>
            </Reveal>
          </div>

          {/* Colonne visuel animé */}
          <Reveal delay={0.2} y={32} className="flex justify-center lg:justify-end">
            <PointerParallax strength={14}>
              <ProspectingConsole />
            </PointerParallax>
          </Reveal>
        </div>
      </section>

      {/* ===================== BANDEAU INTÉGRATIONS ===================== */}
      <section className="border-y border-white/5 bg-white/[0.02] py-10">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-slate-500">
          S&apos;intègre à votre stack
        </p>
        <div className="mask-fade-x relative flex overflow-hidden">
          <div className="flex shrink-0 animate-marquee items-center gap-10 pr-10">
            {[...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 whitespace-nowrap text-lg font-semibold text-slate-400"
              >
                <Plug className="h-4 w-4 text-amber-400/70" />
                {name}
              </span>
            ))}
          </div>
          <div
            className="flex shrink-0 animate-marquee items-center gap-10 pr-10"
            aria-hidden
          >
            {[...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 whitespace-nowrap text-lg font-semibold text-slate-400"
              >
                <Plug className="h-4 w-4 text-amber-400/70" />
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ========================= PROBLÈME ========================= */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Le coût de la prospection"
            title={
              <>
                La prospection téléphonique manuelle{" "}
                <span className="text-gradient-gold">
                  ne passe pas à l&apos;échelle
                </span>
              </>
            }
            desc="Recruter, former et payer des commerciaux pour appeler à froid coûte cher — et la majorité des appels n'aboutissent jamais. Vos meilleurs vendeurs passent leurs journées à composer des numéros."
          />
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              {
                icon: PhoneOff,
                stat: "8 appels sur 10",
                label: "n'aboutissent pas : messagerie, faux numéros ou refus immédiat.",
              },
              {
                icon: TrendingDown,
                stat: "Coût par lead élevé",
                label: "salaires, primes et temps passé à prospecter à la main, sans garantie de résultat.",
              },
              {
                icon: Clock,
                stat: "Des heures perdues",
                label: "à composer, relancer et noter chaque appel, un prospect à la fois.",
              },
            ].map((item, i) => (
              <Reveal key={item.stat} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/20">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 font-display text-2xl font-bold text-white">
                    {item.stat}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {item.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====================== COMMENT ÇA MARCHE ====================== */}
      <section id="how" className="relative scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Comment ça marche"
            title="De votre liste aux leads chauds, en 3 étapes"
            desc="Vous importez vos prospects, l'IA passe les appels et qualifie l'intérêt pendant que vous vous concentrez sur la vente."
          />
          <div className="relative mt-16">
            <div
              className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent lg:block"
              aria-hidden
            />
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.12}>
                  <div className="relative text-center">
                    <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-amber-400/20 bg-slate-950 text-amber-400 shadow-glow">
                      <step.icon className="h-7 w-7" />
                    </div>
                    <h3 className="mt-5 font-display text-lg font-semibold text-white">
                      {step.title}
                    </h3>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
                      {step.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================= DÉMO IMMERSIVE ========================= */}
      <section
        id="demo"
        className="relative scroll-mt-20 overflow-hidden py-20 sm:py-28"
      >
        <Aurora />
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-300">
                Démonstration
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Écoutez votre IA qualifier un prospect,{" "}
                <span className="text-gradient-gold">en direct</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 text-lg leading-relaxed text-slate-400">
                Une voix naturelle, un ton professionnel, une conversation qui va
                droit au but. Voici ce que vos prospects entendent.
              </p>
            </Reveal>
            <div className="mt-8 space-y-4">
              {[
                "Se présente au nom de votre entreprise",
                "Présente l'offre et répond aux objections",
                "Décroche un rendez-vous ou qualifie l'intérêt",
                "Met à jour le statut et la transcription automatiquement",
              ].map((point, i) => (
                <Reveal key={point} delay={0.15 + i * 0.07}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <span className="text-slate-200">{point}</span>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.45}>
              <p className="mt-6 text-sm text-slate-500">
                Le même moteur confirme aussi vos commandes COD Shopify &amp;
                WooCommerce.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.15} y={32} className="flex justify-center lg:justify-end">
            <PointerParallax strength={12}>
              <CallMockup />
            </PointerParallax>
          </Reveal>
        </div>
      </section>

      {/* ========================= FONCTIONNALITÉS ========================= */}
      <section id="features" className="relative scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Fonctionnalités"
            title={
              <>
                Tout pour prospecter{" "}
                <span className="text-gradient-gold">à grande échelle</span>
              </>
            }
            desc="Campagnes d'appels sortants, qualification IA, facturation et analytics — et la confirmation de commandes COD en bonus."
          />
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/30 hover:bg-white/[0.05]">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110 ${f.tint}`}
                  >
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-white">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {f.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =========================== STATS =========================== */}
      <section className="relative overflow-hidden py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-10 sm:grid-cols-4">
            {[
              {
                to: 300,
                suffix: "+",
                label: "appels de prospection par jour et par campagne",
              },
              {
                to: 3,
                suffix: "×",
                label: "plus de leads qualifiés qu'en prospection manuelle",
              },
              {
                to: 24,
                suffix: "/7",
                label: "des appels sortants qui ne dorment jamais",
              },
              {
                to: 100,
                suffix: " %",
                label: "automatique, de l'import CSV au lead qualifié",
              },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08} className="text-center">
                <p className="font-display text-4xl font-bold text-gradient-gold sm:text-5xl">
                  <StatCounter to={s.to} suffix={s.suffix} />
                </p>
                <p className="mx-auto mt-2 max-w-[12rem] text-sm text-slate-400">
                  {s.label}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =========================== POUR QUI =========================== */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Pour qui ?"
            title="Pensé pour celles et ceux qui vendent"
          />
          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
            {PERSONAS.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.1}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/30 hover:bg-white/[0.05]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-400/20">
                    <p.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold text-white">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {p.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =========================== TARIFS =========================== */}
      <section id="pricing" className="relative scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Tarifs"
            title="Payez seulement ce que vous utilisez"
            desc="Pas d'abonnement, pas de surprise. Vous rechargez votre wallet en FCFA et chaque appel est facturé à la seconde, marge transparente incluse."
          />
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal>
              <div className="relative h-full overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-500/[0.08] to-transparent p-8 shadow-glow">
                <span className="absolute right-5 top-5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/30">
                  Recommandé
                </span>
                <h3 className="font-display text-xl font-semibold text-white">
                  Paiement à l&apos;usage
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-bold text-white">
                    ~52
                  </span>
                  <span className="text-slate-400">FCFA / minute d&apos;appel</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Estimation pour un appel typique. Vous ne payez que les appels
                  réellement passés.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Prospection B2B + confirmation COD",
                    "Transcriptions, résumés & enregistrements",
                    "Import CSV & intégrations Shopify / WooCommerce",
                    "Tableau de bord & analytics en temps réel",
                    "Wallet rechargeable, sans engagement",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-base font-semibold text-slate-950 transition-colors hover:bg-amber-400"
                >
                  Créer mon compte
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-8">
                <h3 className="font-display text-xl font-semibold text-white">
                  Entreprise
                </h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-bold text-white">
                    Sur mesure
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Volumes élevés, voix dédiée, langues locales prioritaires et
                  accompagnement personnalisé.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Tarif dégressif au volume",
                    "Voix & langues locales sur demande",
                    "Multi-comptes & multi-équipes",
                    "Support prioritaire dédié",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-slate-200">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/[0.07]"
                >
                  Nous contacter
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================= FAQ ============================= */}
      <section id="faq" className="relative scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="FAQ" title="Questions fréquentes" />
          <div className="mt-12 space-y-3">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.05}>
                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors open:border-amber-400/20 open:bg-white/[0.05]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-white">
                    {item.q}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-amber-400 transition-transform duration-300 group-open:rotate-45">
                      <span className="text-lg leading-none">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== CTA FINAL ========================== */}
      <section className="relative px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.12] via-slate-900 to-violet-600/[0.12] px-6 py-16 text-center sm:px-12">
          <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
          <div className="relative">
            <Reveal>
              <Rocket className="mx-auto h-10 w-10 text-amber-400" />
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mx-auto mt-5 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Prêt à remplir votre pipeline&nbsp;?
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
                Lancez votre première campagne d&apos;appels IA en quelques
                minutes. Sans carte bancaire, sans engagement.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Magnetic className="w-full sm:w-auto">
                  <Link
                    href="/register"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-7 py-4 text-base font-semibold text-slate-950 shadow-glow transition-all hover:bg-amber-400 sm:w-auto"
                  >
                    Commencer gratuitement
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Magnetic>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 px-7 py-4 text-base font-medium text-white transition-colors hover:bg-white/[0.07] sm:w-auto"
                >
                  J&apos;ai déjà un compte
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900">
                <PhoneCall className="h-4 w-4" />
              </span>
              <span className="font-display text-lg font-semibold text-white">
                Afrivoice<span className="text-amber-400">AI</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <a href="#features" className="hover:text-white">Fonctionnalités</a>
              <a href="#how" className="hover:text-white">Comment ça marche</a>
              <a href="#pricing" className="hover:text-white">Tarifs</a>
              <a href="#faq" className="hover:text-white">FAQ</a>
              <Link href="/login" className="hover:text-white">Se connecter</Link>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-slate-500 sm:flex-row">
            <p>© {new Date().getFullYear()} AfrivoiceAI. Tous droits réservés.</p>
            <p className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-amber-400/70" />
              Fait avec
              <Heart className="h-3.5 w-3.5 text-rose-400" />
              pour l&apos;Afrique
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
