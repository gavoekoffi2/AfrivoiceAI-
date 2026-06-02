import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://afrivoiceai-mvp.netlify.app"
  ),
  title: {
    default: "AfrivoiceAI — L'IA vocale qui confirme vos commandes",
    template: "%s · AfrivoiceAI",
  },
  description:
    "AfrivoiceAI appelle automatiquement vos clients par IA vocale pour confirmer les commandes en paiement à la livraison et prospecter en B2B. Moins d'annulations, plus de livraisons réussies. Conçu pour l'Afrique, facturé en FCFA.",
  keywords: [
    "voice AI",
    "IA vocale",
    "Afrique",
    "confirmation commande",
    "paiement à la livraison",
    "COD",
    "Shopify",
    "WooCommerce",
    "prospection",
    "Togo",
    "FCFA",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "AfrivoiceAI — L'IA vocale qui confirme vos commandes",
    description:
      "Automatisez vos appels de confirmation COD et votre prospection B2B avec une IA vocale conçue pour l'Afrique.",
    siteName: "AfrivoiceAI",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
