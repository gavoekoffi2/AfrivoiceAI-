import Link from "next/link";
import { PhoneCall } from "lucide-react";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { href: "#features", label: "Fonctionnalités" },
      { href: "#how", label: "Comment ça marche" },
      { href: "#use-cases", label: "Cas d'usage" },
      { href: "#pricing", label: "Tarifs" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Compte",
    links: [
      { href: "/register", label: "Créer un compte" },
      { href: "/login", label: "Se connecter" },
      { href: "/forgot-password", label: "Mot de passe oublié" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/terms", label: "CGU" },
      { href: "/privacy", label: "Confidentialité" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-white/5 bg-slate-950 pb-10 pt-16">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500">
                <PhoneCall className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold tracking-tight text-white">
                AfrivoiceAI
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-slate-400">
              Une intelligence artificielle vocale qui décroche votre téléphone,
              parle français naturellement, et transforme vos appels en chiffre
              d&apos;affaires.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Tous les systèmes opérationnels
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-300 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} AfrivoiceAI. Tous droits réservés.</p>
          <p>Voice AI pour les équipes qui veulent vendre plus.</p>
        </div>
      </div>
    </footer>
  );
}
