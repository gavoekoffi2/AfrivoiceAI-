import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AfrivoiceAI - Plateforme de Voice AI pour l'Afrique",
  description:
    "Automatisez vos appels téléphoniques avec l'Intelligence Artificielle. Confirmation de commandes COD, prospection B2B, et plus encore.",
  keywords: ["voice AI", "Africa", "appels automatisés", "e-commerce", "Togo"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
