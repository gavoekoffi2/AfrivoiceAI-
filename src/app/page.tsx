import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";

// Point d'entrée racine. Redirige selon l'état d'authentification.
// Doublonne volontairement la logique du middleware (robustesse cross-plateforme :
// la conversion du middleware en edge function Netlify peut ne pas couvrir "/").
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getUserSession();
  redirect(session ? "/dashboard" : "/login");
}
