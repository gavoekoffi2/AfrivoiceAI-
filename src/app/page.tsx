import type { Metadata } from "next";
import { PublicLandingPage } from "@/components/shared/public-landing-page";

export const metadata: Metadata = {
  title: "AfrivoxAI — Agents vocaux IA pour les entreprises africaines",
  description:
    "AfrivoxAI appelle, répond et qualifie vos prospects automatiquement. Prospection B2B, confirmation de commandes et voix locales, pensées pour l'Afrique.",
};

export default function HomePage() {
  return <PublicLandingPage />;
}
