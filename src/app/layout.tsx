import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AfrivoxAI - Plateforme de Voice AI pour l'Afrique",
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
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
