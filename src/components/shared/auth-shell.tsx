"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, PhoneCall, ShieldCheck, UsersRound } from "lucide-react";

const highlights = [
  {
    icon: Bot,
    title: "Agent vocal IA",
    text: "Appelle, écoute et répond naturellement à vos prospects.",
  },
  {
    icon: UsersRound,
    title: "Prospection qualifiée",
    text: "Chaque appel remonte un résumé, un score et la prochaine action.",
  },
  {
    icon: ShieldCheck,
    title: "Données protégées",
    text: "Vos campagnes et vos prospects restent isolés dans votre espace.",
  },
];

interface AuthShellProps {
  badge: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ badge, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-stretch overflow-hidden bg-[#050507] text-white selection:bg-violet-300 selection:text-black">
      {/* Décor d'arrière-plan */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:54px_54px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-emerald-400/10 blur-[100px]" />

      {/* Panneau marque (desktop) */}
      <aside className="relative z-10 hidden w-[46%] flex-col justify-between border-r border-white/10 bg-white/[0.02] p-10 lg:flex">
        <Link href="/" className="group flex w-fit items-center gap-3">
          <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-violet-950/50">
            <span className="absolute inset-0 bg-gradient-to-br from-violet-400/50 via-transparent to-emerald-300/25 opacity-90 transition duration-500 group-hover:scale-125" />
            <PhoneCall className="relative h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em]">AfrivoxAI</p>
            <p className="text-[11px] text-white/45">Voice AI pour l&apos;Afrique</p>
          </div>
        </Link>

        <div className="space-y-8">
          <h2 className="max-w-md text-4xl font-semibold leading-[1.05] tracking-[-0.05em]">
            Chaque appel devient une opportunité commerciale.
          </h2>
          <div className="space-y-4">
            {highlights.map((item, index) => (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur transition duration-500 hover:border-violet-300/30 hover:bg-white/[0.06]"
                style={{ animation: `auth-rise .7s ease-out both`, animationDelay: `${index * 140}ms` }}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-100">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/55">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/35">
          © {new Date().getFullYear()} AfrivoxAI. Tous droits réservés.
        </p>
      </aside>

      {/* Formulaire */}
      <section className="relative z-10 flex flex-1 items-center justify-center p-4 py-10 md:p-8">
        <div className="w-full max-w-md space-y-6" style={{ animation: "auth-rise .6s ease-out both" }}>
          <div className="flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06]">
                <PhoneCall className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">AfrivoxAI</span>
            </Link>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>

          <div className="rounded-[32px] border border-white/10 bg-[#0b0c12]/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl md:p-8">
            <div className="mb-6 space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-sm text-violet-100">
                {badge}
              </span>
              <h1 className="text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
              <p className="text-sm leading-6 text-white/55">{subtitle}</p>
            </div>
            {children}
          </div>

          {footer}
        </div>
      </section>

      <style jsx global>{`
        @keyframes auth-rise {
          from {
            transform: translateY(18px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}
