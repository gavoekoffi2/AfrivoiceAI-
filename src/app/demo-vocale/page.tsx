import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Globe2, PhoneCall } from "lucide-react";
import { AfrivoxLiveDemo } from "@/components/shared/afrivox-live-demo";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Démonstration vocale | AfrivoxAI",
  description:
    "Testez AfrivoxAI, le centre d’appels intelligent africain, directement depuis votre navigateur.",
};

const capabilities = [
  "Service client et qualification des demandes",
  "Prospection commerciale et prise de rendez-vous",
  "Confirmation de commandes et enquêtes",
];

export default function VoiceDemoPage() {
  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-white/10">
          <Link href="/" className="flex items-center gap-3" aria-label="Retour à AfrivoxAI">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300 dark:bg-white dark:text-emerald-700">
              <PhoneCall className="size-5" />
            </span>
            <span>
              <strong className="block text-lg">AfrivoxAI</strong>
              <span className="block text-xs text-muted-foreground">Centre d’appels intelligent</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
            Plateforme
          </Link>
        </header>

        <section className="py-8 sm:py-12">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Prototype fonctionnel</Badge>
              <Badge variant="outline" className="border-emerald-300 text-emerald-800 dark:text-emerald-300">
                <Globe2 className="mr-1 size-3" />
                Aucun numéro téléphonique requis
              </Badge>
            </div>
            <h1 className="text-balance text-4xl font-bold sm:text-5xl">
              Faites la démonstration d’un véritable centre d’appels IA.
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Le client parle depuis son téléphone ou son ordinateur. AfrivoxAI écoute, répond à voix haute, s’interrompt naturellement et affiche la transcription en direct — sans Twilio, sans SIM et sans téléphone dédié.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {capabilities.map((capability) => (
              <div key={capability} className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <p className="text-pretty text-sm font-medium">{capability}</p>
              </div>
            ))}
          </div>
        </section>

        <AfrivoxLiveDemo />

        <footer className="mt-8 border-t border-slate-200 py-6 text-center text-sm text-muted-foreground dark:border-white/10">
          Démonstration AfrivoxAI par Pro Genius AI · La téléphonie togolaise +228 sera raccordée par SIP pour la production.
        </footer>
      </div>
    </main>
  );
}
