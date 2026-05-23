import Link from "next/link";
import {
  PhoneCall,
  ShoppingCart,
  Megaphone,
  Wallet,
  Mic2,
  Globe,
  Shield,
  Zap,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">
      <header className="container mx-auto flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <PhoneCall className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">AfrivoiceAI</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="text-white hover:bg-white/10">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Commencer</Link>
          </Button>
        </div>
      </header>

      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <Badge variant="comingSoon" className="mb-4">
          Made in Africa, for Africa
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          La Voice AI <span className="text-primary">africaine</span>
          <br />
          qui parle français.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-slate-300">
          Automatisez vos appels téléphoniques avec une IA qui confirme vos
          commandes COD, prospecte vos leads et libère votre équipe. Tarification
          en FCFA, déploiement en 5 minutes.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="text-base">
            <Link href="/register">Créer un compte gratuit</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="text-base border-white/20 text-white hover:bg-white/10"
          >
            <Link href="#features">Voir les fonctionnalités</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Aucune carte requise — premier crédit offert.
        </p>
      </section>

      <section id="features" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Tout ce qu&apos;il faut pour vendre par téléphone
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: ShoppingCart,
              title: "Confirmation COD automatique",
              description:
                "Connectez Shopify ou WooCommerce. Dès qu'une commande paiement-à-la-livraison arrive, l'IA appelle le client en moins d'une minute.",
            },
            {
              icon: Megaphone,
              title: "Prospection B2B",
              description:
                "Importez votre fichier de leads, écrivez votre script, l'IA appelle pour vous. 10x plus rapide que votre meilleur commercial.",
            },
            {
              icon: Wallet,
              title: "Wallet FCFA prépayé",
              description:
                "Pas d'abonnement. Vous payez à l'appel, en francs CFA. Recharge par carte bancaire ou Mobile Money (bientôt).",
            },
            {
              icon: Mic2,
              title: "Voix réalistes en français",
              description:
                "Voix générées par ElevenLabs, indistinguables d'une voix humaine. Accent neutre francophone.",
            },
            {
              icon: Globe,
              title: "Langues locales (bientôt)",
              description:
                "Éwé, Wolof, Fon, Dioula, Twi, Haoussa — parce que vos clients préfèrent leur langue.",
            },
            {
              icon: Shield,
              title: "Sécurité & multi-tenant",
              description:
                "Données isolées par organisation, webhooks signés HMAC, conformité RGPD.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 mb-4">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-primary/20 to-purple-900/20 border border-white/10 p-8 md:p-12 text-center">
          <Zap className="mx-auto h-10 w-10 text-primary mb-4" />
          <h2 className="text-3xl font-bold">Prêt à automatiser vos appels ?</h2>
          <p className="mt-3 text-slate-300 max-w-xl mx-auto">
            Inscription en 30 secondes. Configuration en 5 minutes. Premier appel
            dans la foulée.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/register">Démarrer maintenant</Link>
          </Button>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" /> Sans carte
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" /> Sans engagement
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" /> Support
              francophone
            </span>
          </div>
        </div>
      </section>

      <footer className="container mx-auto px-4 py-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span>© {new Date().getFullYear()} AfrivoiceAI. Tous droits réservés.</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white">
              CGU
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Confidentialité
            </Link>
            <Link href="/login" className="hover:text-white">
              Connexion
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
