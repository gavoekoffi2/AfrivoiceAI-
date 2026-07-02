import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AfrivoxAI — Connexion",
  description: "Connectez-vous à votre espace AfrivoxAI",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
