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
    default: "AfrivoiceAI — L'IA vocale qui prospecte vos clients B2B",
    template: "%s · AfrivoiceAI",
  },
  description:
    "AfrivoiceAI lance des campagnes d'appels sortants par IA vocale : votre assistant appelle, qualifie et relance vos prospects B2B — et confirme aussi vos commandes COD. Conçu pour l'Afrique, facturé en FCFA, sans abonnement.",
  keywords: [
    "prospection téléphonique B2B",
    "appels sortants IA",
    "IA vocale",
    "voice AI",
    "qualification de leads",
    "centre d'appels IA",
    "Afrique",
    "confirmation commande COD",
    "Shopify",
    "WooCommerce",
    "Togo",
    "FCFA",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "AfrivoiceAI — L'IA vocale qui prospecte vos clients B2B",
    description:
      "Lancez des campagnes d'appels de prospection B2B par IA vocale : qualification, relance et confirmation COD. Conçu pour l'Afrique.",
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
