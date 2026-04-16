import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AfrivoiceAI — Connexion",
  description: "Connectez-vous à votre espace AfrivoiceAI",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
