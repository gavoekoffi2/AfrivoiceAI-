import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AfrivoiceAI — Voice AI pour l'Afrique",
    template: "%s · AfrivoiceAI",
  },
  description:
    "Automatisez vos appels téléphoniques avec l'Intelligence Artificielle : confirmation de commandes COD, prospection B2B, et plus encore.",
  keywords: [
    "voice AI",
    "Afrique",
    "Togo",
    "appels automatisés",
    "e-commerce",
    "COD",
    "prospection",
    "Vapi",
  ],
  authors: [{ name: "AfrivoiceAI" }],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    title: "AfrivoiceAI — Voice AI pour l'Afrique",
    description:
      "Automatisez vos appels avec une IA vocale qui parle français et confirme vos commandes COD.",
    siteName: "AfrivoiceAI",
  },
  twitter: {
    card: "summary_large_image",
    title: "AfrivoiceAI",
    description: "Voice AI pour l'Afrique",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
