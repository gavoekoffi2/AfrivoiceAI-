"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  Headphones,
  MessageCircle,
  MousePointer2,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const workflow = [
  {
    icon: Database,
    label: "01 · Cible",
    title: "Prospect sélectionné",
    text: "Pays, secteur, base commerciale et objectif d’appel sont prêts.",
  },
  {
    icon: Bot,
    label: "02 · Conversation",
    title: "L’agent appelle",
    text: "La voix IA écoute, répond et qualifie l’intention du prospect.",
  },
  {
    icon: CheckCircle2,
    label: "03 · Action",
    title: "Vente priorisée",
    text: "Résumé, score, intérêt et prochaine action remontent à l’équipe.",
  },
];

const sectors = ["Cliniques", "Écoles", "Immobilier", "E-commerce", "ONG", "BTP", "Finance", "Distribution"];

const imageScenes = [
  {
    title: "Équipe africaine connectée",
    label: "Support & ventes assistés par IA",
    src: "/landing/african-team.jpg",
  },
  {
    title: "Entrepreneurs africains",
    label: "Prospection locale et croissance terrain",
    src: "/landing/african-entrepreneurs.jpg",
  },
  {
    title: "Relation client premium",
    label: "Qualification et rendez-vous",
    src: "/landing/african-support.jpg",
  },
];

const liveEvents = [
  "Appel client lancé",
  "Besoin détecté",
  "Objection traitée",
  "Prospect intéressé",
  "Résumé envoyé",
];

const callTranscript = [
  { from: "Agent IA", text: "Bonjour, je vous appelle pour confirmer votre besoin cette semaine." },
  { from: "Client", text: "Oui, envoyez-moi l’offre. Nous voulons automatiser nos appels." },
  { from: "Agent IA", text: "Parfait. Je transmets votre demande prioritaire à l’équipe commerciale." },
];

export function PublicLandingPage() {
  const [pointer, setPointer] = useState({ x: 50, y: 35 });
  const [activeScene, setActiveScene] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveScene((current) => (current + 1) % imageScenes.length);
    }, 3400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      setScrollProgress(Math.min(window.scrollY / max, 1));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const spotlight = useMemo(
    () => ({
      background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(141, 107, 255, 0.34), transparent 25%), radial-gradient(circle at ${100 - pointer.x}% ${pointer.y + 12}%, rgba(16, 185, 129, 0.18), transparent 24%), radial-gradient(circle at 50% ${24 + scrollProgress * 52}%, rgba(255, 199, 119, 0.10), transparent 28%)`,
    }),
    [pointer, scrollProgress]
  );

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#050507] text-white selection:bg-violet-300 selection:text-black"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: Math.round(((event.clientX - rect.left) / rect.width) * 100),
          y: Math.round(((event.clientY - rect.top) / rect.height) * 100),
        });
      }}
    >
      <div className="pointer-events-none fixed left-0 top-0 z-50 h-1 bg-gradient-to-r from-emerald-300 via-violet-300 to-amber-200 shadow-[0_0_28px_rgba(167,139,250,.75)] transition-all duration-150" style={{ width: `${scrollProgress * 100}%` }} />
      <div className="pointer-events-none fixed inset-0 transition duration-300" style={spotlight} />
      <div className="pointer-events-none fixed inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:54px_54px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.10),transparent_34%),linear-gradient(180deg,transparent,rgba(5,5,7,.72))]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[540px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full border border-emerald-300/10 animate-[spin-slow_26s_linear_infinite]" />
      <div className="pointer-events-none absolute -left-28 top-[620px] h-96 w-96 rounded-full border border-violet-300/10 animate-[spin-slow_32s_linear_infinite_reverse]" />

      <FloatingCursor pointer={pointer} />
      <ScrollConstellation progress={scrollProgress} />

      <nav className="sticky top-4 z-40 mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-8">
        <div className="flex w-full items-center justify-between rounded-full border border-white/10 bg-[#0b0c10]/70 px-3 py-2 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <Link href="/" className="group flex items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-violet-950/50">
              <span className="absolute inset-0 bg-gradient-to-br from-violet-400/50 via-transparent to-emerald-300/25 opacity-90 transition duration-500 group-hover:scale-125" />
              <PhoneCall className="relative h-5 w-5 text-white" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em]">AfrivoxAI</p>
              <p className="text-[11px] text-white/45">Voice AI pour l’Afrique</p>
            </div>
          </Link>
          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 text-sm text-white/65 backdrop-blur md:flex">
            <a href="#experience" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white">Expérience</a>
            <a href="#parcours" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white">Parcours</a>
            <a href="#solutions" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white">Solutions</a>
            <a href="#packs" className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white">Prospects</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden text-sm text-white/65 transition hover:text-white sm:block">
              Connexion
            </Link>
            <Button asChild className="rounded-full bg-white px-5 text-black hover:bg-white/90">
              <Link href="/register">Démarrer <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 md:px-6 lg:grid-cols-[1fr_0.98fr] lg:px-8 lg:pb-24 lg:pt-16">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-sm text-violet-100 shadow-2xl shadow-violet-950/20 backdrop-blur">
            <Sparkles className="h-4 w-4 animate-[spark_2.8s_ease-in-out_infinite]" />
            Une force commerciale IA pour les entreprises africaines
          </div>

          <div className="space-y-5">
            <h1 className="max-w-5xl text-5xl font-semibold leading-[0.95] tracking-[-0.07em] text-white md:text-7xl lg:text-[92px]">
              Chaque appel devient une scène de vente intelligente.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-white/64 md:text-xl">
              AfrivoxAI appelle, répond et qualifie vos prospects. L’expérience montre simplement comment une voix IA transforme une conversation en opportunité commerciale.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="group h-14 rounded-full bg-[#756dff] px-7 text-white shadow-2xl shadow-violet-950/40 hover:bg-[#8a84ff]">
              <Link href="/register">
                Créer un compte
                <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/10 bg-white/[0.03] px-7 text-white hover:bg-white/10 hover:text-white">
              <Link href="/login">Voir le tableau de bord</Link>
            </Button>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-3">
            <HeroStat value="24/7" label="réponse automatique" />
            <HeroStat value="3 pays" label="couverts" />
            <HeroStat value="1 clic" label="campagne IA" />
          </div>
        </div>

        <div id="experience" className="relative min-h-[750px] lg:min-h-[810px]">
          <div className="absolute left-0 top-8 h-[640px] w-full rounded-[44px] border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/40 backdrop-blur-xl" />
          <div className="absolute inset-x-2 top-0 rounded-[38px] border border-white/10 bg-[#0e0f13]/95 p-4 shadow-2xl shadow-violet-950/30 backdrop-blur-2xl md:inset-x-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-300" />
                <span className="h-3 w-3 rounded-full bg-emerald-300" />
              </div>
              <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">campagne active</div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-black/30">
              <div className="relative h-80 md:h-[360px]">
                {imageScenes.map((scene, index) => (
                  <img
                    key={scene.title}
                    src={scene.src}
                    alt={scene.title}
                    className={`absolute inset-0 h-full w-full object-cover transition duration-1000 ${activeScene === index ? "scale-100 opacity-85" : "scale-110 opacity-0"}`}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-[#08090a] via-[#08090a]/35 to-transparent" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[scan-x_4s_ease-in-out_infinite]" />
                <div className="absolute left-5 top-5 flex gap-2">
                  {imageScenes.map((scene, index) => (
                    <button
                      key={scene.title}
                      type="button"
                      aria-label={scene.title}
                      onClick={() => setActiveScene(index)}
                      className={`h-2 rounded-full transition-all ${activeScene === index ? "w-10 bg-white" : "w-2 bg-white/35"}`}
                    />
                  ))}
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Afrique business</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{imageScenes[activeScene].title}</h3>
                  <p className="text-sm text-white/65">{imageScenes[activeScene].label}</p>
                </div>
              </div>
            </div>

            <CallTheater />

            <div className="relative mt-5 overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.035] p-4">
              <div className="absolute left-8 right-8 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-300/50 to-transparent" />
              <div className="absolute left-8 top-1/2 h-px w-24 bg-emerald-200 shadow-[0_0_24px_rgba(110,231,183,.8)] animate-[scan_3s_ease-in-out_infinite]" />
              <div className="relative grid gap-3 md:grid-cols-3">
                {workflow.map((step, index) => (
                  <div
                    key={step.title}
                    className="group rounded-3xl border border-white/10 bg-[#11121a]/90 p-4 transition duration-300 hover:-translate-y-1 hover:border-violet-300/40 hover:bg-violet-400/10"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.06] text-violet-100 transition group-hover:scale-110 group-hover:bg-violet-400/20">
                        <step.icon className="h-5 w-5" />
                      </span>
                      <span className="font-mono text-xs text-white/30">0{index + 1}</span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/35">{step.label}</p>
                    <h4 className="mt-2 text-sm font-semibold leading-5 text-white">{step.title}</h4>
                    <p className="mt-2 text-xs leading-5 text-white/55">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute -left-2 bottom-32 w-72 rounded-[30px] border border-emerald-300/20 bg-emerald-400/10 p-4 shadow-2xl shadow-emerald-950/30 backdrop-blur animate-[float_6s_ease-in-out_infinite]">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Appel en cours</p>
                <p className="text-xs text-white/55">Qualification automatique</p>
              </div>
            </div>
            <div className="mt-4 flex items-end gap-1.5">
              {Array.from({ length: 18 }).map((_, index) => (
                <span
                  key={index}
                  className="w-2 rounded-full bg-emerald-200/70 animate-[voice_1.2s_ease-in-out_infinite]"
                  style={{ height: `${14 + ((index * 17) % 42)}px`, animationDelay: `${index * 55}ms` }}
                />
              ))}
            </div>
          </div>

          <div className="absolute right-0 bottom-12 w-80 rounded-[30px] border border-violet-300/20 bg-[#11121a]/90 p-4 shadow-2xl shadow-violet-950/40 backdrop-blur animate-[float_7s_ease-in-out_infinite_700ms]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Prospect chaud détecté</p>
                <p className="text-xs text-white/55">Clinique · intéressé · rappel prioritaire</p>
              </div>
              <Zap className="h-5 w-5 text-yellow-200" />
            </div>
            <div className="mt-4 rounded-2xl bg-white/[0.04] p-3 text-xs leading-5 text-white/68">
              “Envoyez-moi votre offre, nous voulons automatiser nos appels.”
            </div>
          </div>

          <div className="absolute -right-2 top-24 hidden w-64 rounded-[28px] border border-white/10 bg-black/35 p-4 backdrop-blur-xl md:block animate-[float_8s_ease-in-out_infinite_1200ms]">
            <div className="flex items-center gap-2 text-xs text-white/45">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              flux commercial
            </div>
            <div className="mt-4 space-y-2">
              {liveEvents.map((event, index) => (
                <div key={event} className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-3 py-2 text-xs text-white/62">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-300/10 font-mono text-[10px] text-violet-100">{index + 1}</span>
                  {event}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="parcours" className="relative z-10 mx-auto max-w-7xl px-4 py-14 md:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(110,231,183,.16),transparent_28%),radial-gradient(circle_at_88%_62%,rgba(167,139,250,.18),transparent_30%)]" />
            <div className="relative">
              <p className="text-sm uppercase tracking-[0.22em] text-emerald-100/70">parcours client</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-0.06em] md:text-6xl">Le visiteur comprend le service en quelques secondes.</h2>
              <p className="mt-5 max-w-xl leading-7 text-white/65">
                Le prospect est choisi, l’agent vocal appelle, puis l’équipe reçoit un contact qualifié avec les informations utiles.
              </p>
            </div>
            <div className="relative mt-8 h-72 overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0b10]">
              <MotionMap />
            </div>
          </div>

          <div className="grid gap-4">
            {[
              { icon: MousePointer2, title: "Navigation fluide", text: "La plateforme est simple, rapide et agréable à découvrir." },
              { icon: PhoneCall, title: "Appel IA", text: "Le prospect comprend immédiatement qu’un agent vocal peut gérer l’appel." },
              { icon: UsersRound, title: "Contact qualifié", text: "L’équipe reçoit un résumé clair pour décider de la suite." },
            ].map((item) => (
              <div key={item.title} className="group rounded-[34px] border border-white/10 bg-[#0d0e12]/90 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-200/30 hover:bg-[#12141b]">
                <div className="mb-5 flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-emerald-100 transition duration-300 group-hover:rotate-3 group-hover:scale-110 group-hover:bg-emerald-300/15">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-300/70 shadow-[0_0_20px_rgba(110,231,183,.65)] transition group-hover:scale-[2.5]" />
                </div>
                <h3 className="text-xl font-semibold tracking-[-0.03em]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="solutions" className="relative z-10 mx-auto max-w-7xl px-4 py-14 md:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.035] p-6 md:p-8">
            <img src="/landing/african-collaboration.jpg" alt="Professionnels africains en collaboration" className="absolute inset-0 h-full w-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/80 to-[#090a0f]/50" />
            <div className="relative">
              <p className="text-sm uppercase tracking-[0.22em] text-emerald-100/70">solutions</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.055em] md:text-5xl">Une expérience qui fait comprendre la valeur en quelques secondes.</h2>
              <p className="mt-5 leading-7 text-white/65">
                Vos équipes suivent l’essentiel : appel IA, qualification, résumé et contact prioritaire. La plateforme paraît vivante, professionnelle et prête pour les premiers utilisateurs.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Store, title: "E-commerce", text: "Confirmer les commandes, vérifier les adresses, rassurer les clients." },
              { icon: MessageCircle, title: "Prospection B2B", text: "Appeler les bases prospects par pays et détecter les clients chauds." },
              { icon: PhoneCall, title: "Appels entrants", text: "Répondre quand l’équipe est occupée et capturer chaque demande." },
              { icon: ShieldCheck, title: "Suivi premium", text: "Rapports, scripts, scoring et historique pour piloter les ventes." },
            ].map((item) => (
              <div key={item.title} className="group rounded-[34px] border border-white/10 bg-[#0d0e12] p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-[#12131a]">
                <div className="mb-8 flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-violet-100 transition group-hover:rotate-3 group-hover:scale-110">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-300/70 shadow-[0_0_20px_rgba(110,231,183,.65)] transition group-hover:scale-[2.5]" />
                </div>
                <h3 className="text-xl font-semibold tracking-[-0.03em]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="packs" className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[40px] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-white/35">bases prospects</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.055em] md:text-5xl">Choisir un pays, un domaine, lancer les appels.</h2>
            </div>
            <Button asChild className="rounded-full bg-white text-black hover:bg-white/90">
              <Link href="/login">Explorer les packs <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {sectors.map((sector) => (
              <span key={sector} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/62 transition hover:border-violet-300/40 hover:bg-violet-400/10 hover:text-white">
                {sector}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-4 border-t border-white/10 px-4 py-8 text-sm text-white/45 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
            <Building2 className="h-4 w-4 text-white/65" />
          </span>
          <span>© {new Date().getFullYear()} AfrivoxAI. Tous droits réservés.</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="transition hover:text-white">Connexion</Link>
          <Link href="/register" className="transition hover:text-white">Créer un compte</Link>
        </div>
      </footer>

      <style jsx global>{`
        html { scroll-behavior: smooth; }
        @keyframes float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -14px, 0); }
        }
        @keyframes voice {
          0%, 100% { transform: scaleY(.45); opacity: .35; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes scan {
          0% { transform: translateX(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(330px); opacity: 0; }
        }
        @keyframes scan-x {
          0% { transform: translateX(-100%); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes spark {
          0%, 100% { transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          50% { transform: rotate(14deg) scale(1.18); filter: drop-shadow(0 0 16px rgba(196,181,253,.9)); }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(142px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(142px) rotate(-360deg); }
        }
        @keyframes drawLine {
          0% { stroke-dashoffset: 620; opacity: .1; }
          35% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: .2; }
        }
        @keyframes messageRise {
          0%, 18% { transform: translateY(18px); opacity: 0; }
          28%, 82% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-10px); opacity: 0; }
        }
        @keyframes routePulse {
          0% { offset-distance: 0%; opacity: 0; }
          10% { opacity: 1; }
          88% { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}

function FloatingCursor({ pointer }: { pointer: { x: number; y: number } }) {
  return (
    <div
      className="pointer-events-none fixed z-40 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-[11px] text-white/70 shadow-2xl shadow-violet-950/50 backdrop-blur-xl transition duration-300 lg:flex"
      style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
    >
      <MousePointer2 className="h-3.5 w-3.5 text-emerald-100" />
      appel IA
    </div>
  );
}

function ScrollConstellation({ progress }: { progress: number }) {
  return (
    <div className="pointer-events-none fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
      {[0, 0.25, 0.5, 0.75, 1].map((point, index) => {
        const active = progress + 0.08 >= point;
        return (
          <span
            key={point}
            className={`h-2.5 w-2.5 rounded-full border transition duration-500 ${active ? "border-emerald-200 bg-emerald-200 shadow-[0_0_18px_rgba(110,231,183,.9)]" : "border-white/20 bg-white/5"}`}
            style={{ transform: `scale(${active ? 1.15 + index * 0.02 : 1})` }}
          />
        );
      })}
    </div>
  );
}

function CallTheater() {
  return (
    <div className="relative mt-5 overflow-hidden rounded-[30px] border border-white/10 bg-[#080910] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(110,231,183,.16),transparent_24%),radial-gradient(circle_at_78%_32%,rgba(167,139,250,.18),transparent_28%)]" />
      <div className="relative grid gap-4 md:grid-cols-[0.78fr_1.22fr]">
        <div className="relative min-h-56 rounded-[26px] border border-white/10 bg-black/25 p-4">
          <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/20" />
          <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-200/20" />
          {[Bot, PhoneCall, UsersRound].map((Icon, index) => (
            <span
              key={index}
              className="absolute left-1/2 top-1/2 grid h-12 w-12 -ml-6 -mt-6 place-items-center rounded-2xl border border-white/10 bg-white/[0.08] text-white shadow-2xl backdrop-blur"
              style={{ animation: `orbit ${9 + index * 2}s linear infinite`, animationDelay: `${index * -2}s` }}
            >
              <Icon className="h-5 w-5" />
            </span>
          ))}
          <div className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[28px] border border-emerald-200/30 bg-emerald-300/10 text-emerald-100 shadow-[0_0_60px_rgba(110,231,183,.18)]">
            <Headphones className="h-8 w-8" />
          </div>
        </div>

        <div className="relative rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">conversation live</p>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] text-emerald-100">analyse en cours</span>
          </div>
          <div className="space-y-3">
            {callTranscript.map((line, index) => (
              <div
                key={line.text}
                className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-white/68 opacity-0"
                style={{ animation: `messageRise 7.2s ease-in-out infinite`, animationDelay: `${index * 1.55}s` }}
              >
                <span className="mb-1 block font-medium text-white">{line.from}</span>
                {line.text}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-white/55">
            <span className="rounded-2xl bg-white/[0.05] px-2 py-2">Intérêt 92%</span>
            <span className="rounded-2xl bg-white/[0.05] px-2 py-2">Budget détecté</span>
            <span className="rounded-2xl bg-white/[0.05] px-2 py-2">Rappel urgent</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MotionMap() {
  return (
    <div className="absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 700 300" fill="none" aria-hidden="true">
        <path d="M80 210 C180 60, 300 265, 420 108 S585 58, 635 205" stroke="url(#route)" strokeWidth="2" strokeDasharray="620" className="animate-[drawLine_5s_ease-in-out_infinite]" />
        <defs>
          <linearGradient id="route" x1="80" x2="635" y1="210" y2="205">
            <stop stopColor="#6ee7b7" />
            <stop offset="0.52" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#fde68a" />
          </linearGradient>
        </defs>
      </svg>
      {[
        { label: "Base prospects", x: "8%", y: "62%", icon: Database },
        { label: "Agent vocal", x: "43%", y: "24%", icon: Bot },
        { label: "Équipe vente", x: "75%", y: "56%", icon: UsersRound },
      ].map((node) => (
        <div key={node.label} className="absolute rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl backdrop-blur" style={{ left: node.x, top: node.y }}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-100">
              <node.icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">{node.label}</span>
          </div>
        </div>
      ))}
      <span className="absolute h-4 w-4 rounded-full bg-emerald-200 shadow-[0_0_26px_rgba(110,231,183,.9)] [offset-path:path('M_80_210_C_180_60,_300_265,_420_108_S_585_58,_635_205')] animate-[routePulse_4.8s_ease-in-out_infinite]" />
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur transition hover:-translate-y-1 hover:border-violet-300/30 hover:bg-white/[0.06]">
      <p className="font-mono text-2xl font-semibold tracking-[-0.05em] text-white">{value}</p>
      <p className="mt-1 text-xs leading-4 text-white/45">{label}</p>
    </div>
  );
}
