import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Globe,
  Mic2,
  PhoneCall,
  PhoneOutgoing,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroCallDemo } from "@/components/landing/hero-call-demo";
import { Reveal } from "@/components/landing/reveal";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { TiltCard } from "@/components/landing/tilt-card";

export const metadata: Metadata = {
  title: "AfrivoiceAI — La prospection téléphonique B2B, automatisée par l'IA",
  description:
    "Des centaines d'appels de prospection en français naturel, qualifiés et résumés automatiquement. Et la confirmation automatique de vos commandes e-commerce. Conçu pour l'Afrique.",
};

const COUNTRIES = [
  { flag: "🇹🇬", name: "Togo" },
  { flag: "🇨🇮", name: "Côte d'Ivoire" },
  { flag: "🇸🇳", name: "Sénégal" },
  { flag: "🇧🇯", name: "Bénin" },
  { flag: "🇨🇲", name: "Cameroun" },
  { flag: "🇧🇫", name: "Burkina Faso" },
  { flag: "🇲🇱", name: "Mali" },
  { flag: "🇳🇪", name: "Niger" },
  { flag: "🇬🇳", name: "Guinée" },
  { flag: "🇬🇦", name: "Gabon" },
  { flag: "🇨🇩", name: "RD Congo" },
];

const TESTIMONIALS = [
  {
    quote:
      "En une après-midi, l'IA a appelé 120 prospects de ma liste. J'ai retrouvé 14 rendez-vous dans mon agenda, avec le résumé de chaque conversation. Je n'y croyais pas avant de l'entendre parler.",
    name: "Koffi A.",
    role: "Agence digitale · Lomé",
    image:
      "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=160&q=70&fm=jpg&fit=crop&crop=faces",
  },
  {
    quote:
      "Mes clientes commandent en paiement à la livraison. Avant, je passais 3 heures par jour au téléphone pour confirmer. Maintenant Amina appelle dans la minute et je ne livre que les commandes confirmées.",
    name: "Awa D.",
    role: "Boutique mode en ligne · Dakar",
    image:
      "https://images.unsplash.com/photo-1531727991582-cfd25ce79613?w=160&q=70&fm=jpg&fit=crop&crop=faces",
  },
  {
    quote:
      "Le coût par rendez-vous obtenu est dérisoire comparé à un téléopérateur. Et la voix est naturelle au point que les prospects remercient « la dame » à la fin de l'appel.",
    name: "Jean-Marc K.",
    role: "Cabinet de conseil · Abidjan",
    image:
      "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=160&q=70&fm=jpg&fit=crop&crop=faces",
  },
];

const FAQ_ITEMS = [
  {
    question: "La voix est-elle vraiment naturelle ?",
    answer:
      "Oui. Nous combinons les meilleures voix de synthèse du marché (ElevenLabs) avec un modèle conversationnel qui comprend les hésitations, les objections et les accents. Créez un compte et lancez un appel de test vers votre propre numéro : c'est le meilleur moyen de juger.",
  },
  {
    question: "Combien coûte un appel ?",
    answer:
      "Vous payez à la seconde réelle de conversation, sans abonnement. Comptez environ 65 à 100 FCFA par minute selon la durée. Vous rechargez un wallet en FCFA et chaque appel est débité avec un reçu détaillé (durée, coût, transcription).",
  },
  {
    question: "Comment l'IA sait-elle quoi dire à mes prospects ?",
    answer:
      "Vous écrivez votre script en français avec des variables comme {leadName} ou {entreprise}, vous définissez l'objectif (prendre un RDV, qualifier un besoin…), et l'IA mène la conversation naturellement dans ce cadre. Elle qualifie chaque lead : intéressé, à rappeler, non intéressé ou sans réponse.",
  },
  {
    question: "Et pour ma boutique en ligne ?",
    answer:
      "Connectez Shopify ou WooCommerce en deux minutes via un webhook. Dès qu'une commande en paiement à la livraison arrive, l'IA appelle le client pour confirmer la commande et l'adresse. Le statut (confirmée, annulée, sans réponse) se met à jour tout seul dans votre tableau de bord.",
  },
  {
    question: "Dans quelles langues l'IA peut-elle appeler ?",
    answer:
      "En français aujourd'hui, avec une voix naturelle adaptée à l'Afrique francophone. L'éwé, le wolof, le twi et le haoussa sont en cours de développement, ainsi qu'une marketplace de voix africaines authentiques.",
  },
  {
    question: "Mes données et celles de mes clients sont-elles protégées ?",
    answer:
      "Chaque organisation est isolée : vos leads, appels et transcriptions ne sont visibles que par votre équipe. Les webhooks sont signés et vérifiés (HMAC), et nous n'utilisons jamais vos données pour autre chose que vos propres appels.",
  },
];

export default async function LandingPage() {
  // La landing reste accessible même si Supabase n'est pas configuré
  let isAuthenticated = false;
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="min-h-screen scroll-smooth bg-slate-950 text-slate-100 antialiased">
      <LandingNav isAuthenticated={isAuthenticated} />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden pb-20 pt-32 sm:pt-36">
        {/* Décor : orbes + grille 3D */}
        <div aria-hidden className="absolute inset-0">
          <div
            className="orb left-[-10%] top-[-10%] h-[480px] w-[480px]"
            style={{ background: "#7c3aed" }}
          />
          <div
            className="orb right-[-12%] top-[20%] h-[420px] w-[420px]"
            style={{ background: "#b45309", animationDelay: "-5s" }}
          />
          <div
            className="orb bottom-[-20%] left-[30%] h-[380px] w-[380px]"
            style={{ background: "#065f46", animationDelay: "-9s" }}
          />
          <div className="grid-floor absolute inset-0" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8">
          {/* Texte */}
          <div className="max-w-xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
                <Sparkles className="h-3.5 w-3.5" />
                Conçu en Afrique, pour les entreprises africaines
              </span>
            </Reveal>

            <Reveal delay={100}>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
                Votre prospection téléphonique,{" "}
                <span className="animate-gradient bg-gradient-to-r from-violet-400 via-amber-300 to-violet-400 bg-clip-text text-transparent">
                  menée par une IA
                </span>{" "}
                qui parle comme nous.
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">
                Importez votre liste de prospects, écrivez votre script :
                Amina appelle des centaines d&apos;entreprises en français
                naturel, qualifie chaque contact, prend les rendez-vous et
                vous livre transcriptions et résumés.{" "}
                <span className="text-slate-200">
                  Vous ne parlez plus qu&apos;aux prospects intéressés.
                </span>
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="group h-12 bg-violet-600 px-7 text-base hover:bg-violet-500"
                >
                  <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                    {isAuthenticated
                      ? "Accéder au dashboard"
                      : "Lancer mon premier appel IA"}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/20 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white"
                >
                  <a href="#prospection">
                    <PhoneOutgoing className="mr-2 h-4 w-4" />
                    Voir comment ça marche
                  </a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <div className="mt-9 flex items-center gap-4">
                <div className="flex -space-x-2.5">
                  {TESTIMONIALS.map((t) => (
                    <Image
                      key={t.name}
                      src={t.image}
                      alt={t.name}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full border-2 border-slate-950 object-cover"
                    />
                  ))}
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-950 bg-violet-600 text-[10px] font-bold text-white">
                    +60
                  </div>
                </div>
                <p className="text-sm text-slate-400">
                  Adopté par des entrepreneurs à{" "}
                  <span className="text-slate-200">
                    Lomé, Abidjan, Dakar et Cotonou
                  </span>
                </p>
              </div>
            </Reveal>
          </div>

          {/* Démo d'appel animée */}
          <Reveal delay={250} className="lg:justify-self-end">
            <HeroCallDemo />
          </Reveal>
        </div>

        {/* Bande kente */}
        <div className="kente-stripe absolute bottom-0 left-0 h-1 w-full opacity-70" />
      </section>

      {/* ================= MARQUEE PAYS ================= */}
      <section className="border-y border-white/5 bg-slate-900/40 py-5">
        <div className="marquee-mask overflow-hidden">
          <div className="animate-marquee flex w-max items-center gap-10">
            {[...COUNTRIES, ...COUNTRIES].map((country, i) => (
              <span
                key={`${country.name}-${i}`}
                className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-400"
              >
                <span className="text-lg">{country.flag}</span>
                {country.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="relative py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            {
              value: 85,
              prefix: "−",
              suffix: "%",
              label: "de coût par appel vs un téléopérateur",
            },
            {
              value: 12,
              prefix: "×",
              suffix: "",
              label: "plus d'appels passés chaque jour",
            },
            {
              value: 60,
              prefix: "",
              suffix: " s",
              label: "pour lancer votre première campagne",
            },
            {
              value: 24,
              prefix: "",
              suffix: "h/24",
              label: "l'IA appelle quand vos prospects répondent",
            },
          ].map((stat, i) => (
            <Reveal key={stat.label} delay={i * 100}>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 text-center">
                <p className="text-4xl font-extrabold text-white">
                  <AnimatedCounter
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                  />
                </p>
                <p className="mt-2 text-sm text-slate-400">{stat.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= COMMENT ÇA MARCHE ================= */}
      <section id="fonctionnement" className="relative py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Trois étapes.{" "}
              <span className="text-violet-400">Zéro téléopérateur.</span>
            </h2>
            <p className="mt-4 text-slate-400">
              De votre fichier de prospects aux rendez-vous dans votre agenda,
              sans décrocher le téléphone.
            </p>
          </Reveal>

          <Reveal className="relative mt-14">
            {/* Ligne de connexion animée */}
            <div
              aria-hidden
              className="step-line absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-violet-500 via-amber-400 to-emerald-400 lg:block"
            />
            <div className="grid gap-10 lg:grid-cols-3">
              {[
                {
                  icon: FileSpreadsheet,
                  step: "01",
                  title: "Importez vos leads",
                  description:
                    "Un fichier CSV avec noms et numéros suffit. Doublons et numéros invalides sont filtrés automatiquement. Ou connectez votre boutique Shopify / WooCommerce.",
                  color: "from-violet-500 to-violet-600",
                },
                {
                  icon: Bot,
                  step: "02",
                  title: "L'IA appelle avec votre script",
                  description:
                    "Vous définissez l'objectif et le script avec {leadName} et {entreprise}. Amina appelle, gère les objections, propose des créneaux — en français naturel.",
                  color: "from-amber-500 to-amber-600",
                },
                {
                  icon: BarChart3,
                  step: "03",
                  title: "Récoltez les résultats",
                  description:
                    "Chaque appel est transcrit, résumé et qualifié : intéressé, à rappeler, non intéressé, sans réponse. Vous rappelez uniquement les leads chauds.",
                  color: "from-emerald-500 to-emerald-600",
                },
              ].map((item, i) => (
                <Reveal key={item.step} delay={i * 150}>
                  <div className="relative text-center lg:text-left">
                    <div
                      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} shadow-lg lg:mx-0`}
                    >
                      <item.icon className="h-6 w-6 text-white" />
                    </div>
                    <p className="mt-4 text-xs font-bold tracking-widest text-slate-500">
                      ÉTAPE {item.step}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {item.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= PROSPECTION B2B (PRINCIPAL) ================= */}
      <section
        id="prospection"
        className="relative overflow-hidden border-y border-white/5 bg-slate-900/40 py-24"
      >
        <div
          aria-hidden
          className="orb right-[-15%] top-[10%] h-[400px] w-[400px]"
          style={{ background: "#7c3aed", opacity: 0.25 }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                  <Zap className="h-3.5 w-3.5" />
                  Fonctionnalité phare
                </span>
                <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
                  La prospection B2B qui remplit votre agenda,{" "}
                  <span className="text-amber-400">pas vos journées.</span>
                </h2>
                <p className="mt-4 leading-relaxed text-slate-400">
                  Un commercial passe 20 appels par jour et déteste ça.
                  AfrivoiceAI en passe des centaines, sans fatigue, sans
                  oubli de relance, et chaque conversation est documentée.
                </p>
              </Reveal>

              <ul className="mt-8 space-y-4">
                {[
                  {
                    icon: FileText,
                    title: "Script sur mesure",
                    text: "Votre argumentaire, vos variables {leadName} et {entreprise}, votre ton.",
                  },
                  {
                    icon: CheckCircle2,
                    title: "Qualification automatique",
                    text: "Qualifié, à rappeler, non intéressé, sans réponse — classé sans intervention.",
                  },
                  {
                    icon: CalendarCheck,
                    title: "Prise de rendez-vous",
                    text: "L'IA propose vos créneaux et conclut le prochain pas avec le prospect.",
                  },
                  {
                    icon: RotateCcw,
                    title: "Relance intelligente",
                    text: "Les sans-réponse sont remis en file d'un clic pour une nouvelle vague d'appels.",
                  },
                ].map((feature, i) => (
                  <Reveal key={feature.title} delay={i * 100} as="li">
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                        <feature.icon className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {feature.title}
                        </p>
                        <p className="text-sm text-slate-400">{feature.text}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </ul>

              <Reveal delay={400}>
                <Button
                  asChild
                  size="lg"
                  className="mt-9 bg-amber-500 text-slate-950 hover:bg-amber-400"
                >
                  <Link href="/register">
                    Créer ma première campagne
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </Reveal>
            </div>

            {/* Visuel : photo + carte lead flottante */}
            <Reveal delay={200}>
              <TiltCard className="relative">
                <div className="overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                  <Image
                    src="https://images.unsplash.com/photo-1573164574511-73c773193279?w=1000&q=75&fm=jpg"
                    alt="Équipe d'entrepreneurs africains en réunion de prospection"
                    width={1000}
                    height={667}
                    className="h-[420px] w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent" />
                </div>

                {/* Carte lead qualifiée flottante */}
                <div className="tilt-depth absolute -bottom-6 -left-4 w-64 animate-float rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur sm:-left-8">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      Afi Agbeko
                    </p>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      Qualifié ✓
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Gérante · Kekeli Distribution
                  </p>
                  <p className="mt-2 rounded-lg bg-white/5 p-2 text-[11px] italic leading-relaxed text-slate-300">
                    « Intéressée par l&apos;offre groupée. RDV pris jeudi 9h
                    pour une démo. Rappeler sur WhatsApp. »
                  </p>
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                    <PhoneCall className="h-3 w-3" /> 2 min 14 s · 142 FCFA
                  </p>
                </div>
              </TiltCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= E-COMMERCE (SECONDAIRE) ================= */}
      <section id="ecommerce" className="relative overflow-hidden py-24">
        <div
          aria-hidden
          className="orb left-[-12%] bottom-[0%] h-[380px] w-[380px]"
          style={{ background: "#065f46", opacity: 0.3 }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            {/* Visuel d'abord (ordre inversé) */}
            <Reveal delay={200} className="order-2 lg:order-1">
              <TiltCard className="relative">
                <div className="overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                  <Image
                    src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1000&q=75&fm=jpg"
                    alt="Commerçante africaine en tenue wax"
                    width={1000}
                    height={1250}
                    className="h-[440px] w-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent" />
                </div>

                {/* Carte commande flottante */}
                <div className="tilt-depth absolute -right-3 top-8 w-60 animate-float rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur sm:-right-6">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                      <ShoppingCart className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        Commande #1842 · 24 500 F
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Shopify · il y a 38 s
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {[
                      { label: "Commande reçue", done: true },
                      { label: "Client appelé par l'IA", done: true },
                      { label: "Adresse vérifiée", done: true },
                      { label: "Confirmée — prête à livrer", done: true },
                    ].map((step) => (
                      <p
                        key={step.label}
                        className="flex items-center gap-2 text-[11px] text-slate-300"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        {step.label}
                      </p>
                    ))}
                  </div>
                </div>
              </TiltCard>
            </Reveal>

            <div className="order-1 lg:order-2">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Pour les e-commerçants
                </span>
                <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
                  Chaque commande COD confirmée{" "}
                  <span className="text-emerald-400">avant la livraison.</span>
                </h2>
                <p className="mt-4 leading-relaxed text-slate-400">
                  Le paiement à la livraison fait vivre l&apos;e-commerce
                  africain — et les faux numéros, les clients injoignables et
                  les colis refusés le ruinent. Amina appelle chaque client
                  dans la minute qui suit sa commande.
                </p>
              </Reveal>

              <ul className="mt-8 space-y-4">
                {[
                  "Connexion Shopify / WooCommerce en 2 minutes (webhook fourni)",
                  "Appel automatique moins d'une minute après la commande",
                  "Vérification du panier et de l'adresse de livraison",
                  "Statut automatique : confirmée, annulée ou sans réponse",
                  "Relance manuelle en un clic pour les clients injoignables",
                ].map((item, i) => (
                  <Reveal key={item} delay={i * 80} as="li">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                      <span className="text-sm text-slate-300">{item}</span>
                    </div>
                  </Reveal>
                ))}
              </ul>

              <Reveal delay={400}>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="mt-9 border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                >
                  <Link href="/register">
                    Connecter ma boutique
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ================= VOIX & LANGUES ================= */}
      <section className="border-y border-white/5 bg-slate-900/40 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Des voix qui nous{" "}
              <span className="text-violet-400">ressemblent.</span>
            </h2>
            <p className="mt-4 text-slate-400">
              Le français d&apos;Afrique aujourd&apos;hui. Nos langues demain :
              la marketplace de voix africaines arrive, avec des royalties
              pour les créateurs vocaux du continent.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { name: "Amina", lang: "Français", available: true },
              { name: "Sena", lang: "Éwé", available: false },
              { name: "Fatou", lang: "Wolof", available: false },
              { name: "Kwame", lang: "Twi", available: false },
              { name: "Zara", lang: "Haoussa", available: false },
            ].map((voice, i) => (
              <Reveal key={voice.name} delay={i * 80}>
                <div
                  className={`rounded-2xl border p-5 text-center transition-colors ${
                    voice.available
                      ? "border-violet-500/40 bg-violet-500/10"
                      : "border-white/5 bg-white/[0.03] opacity-70"
                  }`}
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-amber-500">
                    <Mic2 className="h-5 w-5 text-white" />
                  </div>
                  {/* Égaliseur */}
                  <div className="mx-auto mt-4 flex h-6 items-end justify-center gap-[3px]">
                    {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                      <span
                        key={bar}
                        className={`eq-bar w-[3px] rounded-full ${
                          voice.available
                            ? "bg-violet-400"
                            : "bg-slate-600"
                        }`}
                        style={{
                          height: `${8 + ((bar * 7) % 14)}px`,
                          animationDelay: `${bar * 0.1}s`,
                          animationPlayState: voice.available
                            ? "running"
                            : "paused",
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 font-semibold text-white">{voice.name}</p>
                  <p className="text-xs text-slate-400">{voice.lang}</p>
                  <span
                    className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                      voice.available
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {voice.available ? "Disponible" : "Bientôt"}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TÉMOIGNAGES ================= */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ils ont confié leurs appels à{" "}
              <span className="text-amber-400">Amina.</span>
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {TESTIMONIALS.map((testimonial, i) => (
              <Reveal key={testimonial.name} delay={i * 120}>
                <figure className="relative h-full overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                  <div className="kente-stripe absolute left-0 top-0 h-1 w-full opacity-60" />
                  <blockquote className="text-sm leading-relaxed text-slate-300">
                    « {testimonial.quote} »
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-full border border-white/10 object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {testimonial.role}
                      </p>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TARIFS ================= */}
      <section
        id="tarifs"
        className="border-y border-white/5 bg-slate-900/40 py-24"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Payez l&apos;appel.{" "}
              <span className="text-violet-400">Rien d&apos;autre.</span>
            </h2>
            <p className="mt-4 text-slate-400">
              Pas d&apos;abonnement, pas d&apos;engagement. Vous rechargez
              votre wallet en FCFA, chaque seconde d&apos;appel est facturée
              au réel.
            </p>
          </Reveal>

          <Reveal delay={150}>
            <div className="mt-12 overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-b from-violet-500/10 to-transparent">
              <div className="grid gap-0 lg:grid-cols-2">
                <div className="border-b border-white/5 p-8 lg:border-b-0 lg:border-r">
                  <p className="text-sm font-medium text-violet-300">
                    Tarification à l&apos;usage
                  </p>
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="text-5xl font-extrabold text-white">
                      ~65
                    </span>
                    <span className="text-lg text-slate-400">
                      FCFA / minute d&apos;appel
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Facturation à la seconde réelle, voix premium et
                    transcription incluses. Le coût exact de chaque appel est
                    détaillé dans votre wallet.
                  </p>
                  <ul className="mt-6 space-y-2.5">
                    {[
                      "Recharge en FCFA (Mobile Money bientôt)",
                      "Transcription + résumé IA inclus",
                      "Enregistrement audio de chaque appel",
                      "Tableau de bord et statistiques en temps réel",
                      "Aucun frais fixe, aucun minimum mensuel",
                    ].map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 text-sm text-slate-300"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col justify-between p-8">
                  <div className="space-y-3">
                    {[
                      {
                        label: "Confirmation d'une commande COD (~1 min)",
                        price: "≈ 65 FCFA",
                      },
                      {
                        label: "Appel de prospection qualifié (~2 min)",
                        price: "≈ 130 FCFA",
                      },
                      {
                        label: "Campagne de 100 prospects",
                        price: "≈ 13 000 FCFA",
                      },
                      {
                        label: "Le même volume avec un téléopérateur",
                        price: "10× plus cher",
                        muted: true,
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3"
                      >
                        <span className="text-sm text-slate-300">
                          {row.label}
                        </span>
                        <span
                          className={`whitespace-nowrap text-sm font-semibold ${
                            row.muted
                              ? "text-slate-500 line-through"
                              : "text-white"
                          }`}
                        >
                          {row.price}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    asChild
                    size="lg"
                    className="mt-8 w-full bg-violet-600 hover:bg-violet-500"
                  >
                    <Link href="/register">
                      <Wallet className="mr-2 h-4 w-4" />
                      Créer mon compte gratuitement
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Questions fréquentes
            </h2>
          </Reveal>

          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <Reveal key={item.question} delay={i * 60}>
                <details className="faq-item group rounded-2xl border border-white/5 bg-white/[0.03] transition-colors hover:border-white/10">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                    <span className="font-medium text-white">
                      {item.question}
                    </span>
                    <ChevronDown className="faq-chevron h-4 w-4 shrink-0 text-slate-400" />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">
                    {item.answer}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="relative overflow-hidden py-24">
        <div aria-hidden className="absolute inset-0">
          <div
            className="orb left-[20%] top-[0%] h-[300px] w-[300px]"
            style={{ background: "#7c3aed", opacity: 0.4 }}
          />
          <div
            className="orb right-[15%] bottom-[0%] h-[280px] w-[280px]"
            style={{ background: "#b45309", opacity: 0.35, animationDelay: "-6s" }}
          />
        </div>
        <Reveal className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-amber-500 shadow-2xl">
            <PhoneOutgoing className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-white sm:text-5xl">
            Recevez votre premier appel IA{" "}
            <span className="animate-gradient bg-gradient-to-r from-violet-400 via-amber-300 to-violet-400 bg-clip-text text-transparent">
              dans 2 minutes.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-400">
            Créez votre compte, cliquez sur « Tester un appel IA » et
            laissez Amina vous appeler sur votre propre numéro. Vous saurez
            immédiatement ce que vos prospects entendront.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group h-12 bg-violet-600 px-8 text-base hover:bg-violet-500"
            >
              <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                {isAuthenticated ? "Ouvrir mon dashboard" : "Commencer maintenant"}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Sans carte bancaire · Sans engagement
            </p>
          </div>
        </Reveal>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-white/5 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-start">
            <div className="text-center md:text-left">
              <Link href="/" className="inline-flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-amber-500">
                  <PhoneCall className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-white">
                  Afrivoice<span className="text-violet-400">AI</span>
                </span>
              </Link>
              <p className="mt-3 max-w-xs text-sm text-slate-500">
                La voix de l&apos;intelligence artificielle au service des
                entreprises africaines.
              </p>
              <p className="mt-3 text-lg" aria-label="Pays couverts">
                🇹🇬 🇨🇮 🇸🇳 🇧🇯 🇨🇲 🇧🇫
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12 text-center sm:text-left">
              <div>
                <p className="text-sm font-semibold text-white">Produit</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li>
                    <a href="#prospection" className="hover:text-white">
                      Prospection B2B
                    </a>
                  </li>
                  <li>
                    <a href="#ecommerce" className="hover:text-white">
                      Confirmation COD
                    </a>
                  </li>
                  <li>
                    <a href="#tarifs" className="hover:text-white">
                      Tarifs
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Compte</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li>
                    <Link href="/register" className="hover:text-white">
                      Créer un compte
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-white">
                      Connexion
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="hover:text-white">
                      Dashboard
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-slate-600 md:flex-row">
            <p>
              © {new Date().getFullYear()} AfrivoiceAI — Fait avec fierté en
              Afrique de l&apos;Ouest.
            </p>
            <p className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Français · Éwé, Wolof, Twi & Haoussa bientôt
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
