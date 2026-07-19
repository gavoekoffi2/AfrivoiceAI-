import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://afrivoxai.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AfrivoxAI — Plateforme de Voice AI pour l'Afrique",
    template: "%s · AfrivoxAI",
  },
  description:
    "Automatisez vos appels téléphoniques avec l'Intelligence Artificielle. Confirmation de commandes COD, prospection B2B, et plus encore.",
  keywords: ["voice AI", "Africa", "appels automatisés", "e-commerce", "Togo"],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "AfrivoxAI",
    title: "AfrivoxAI — Agents vocaux IA pour les entreprises africaines",
    description:
      "AfrivoxAI appelle, répond et qualifie vos prospects automatiquement. Prospection B2B, confirmation de commandes et voix locales.",
    images: [{ url: "/landing/african-team.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AfrivoxAI — Agents vocaux IA pour les entreprises africaines",
    description:
      "AfrivoxAI appelle, répond et qualifie vos prospects automatiquement.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
