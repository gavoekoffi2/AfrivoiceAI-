"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/landing/auth-shell";

const fieldClass =
  "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-amber-400";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <AuthShell
      title="Bon retour"
      subtitle="Connectez-vous à votre espace AfrivoiceAI."
    >
      <form action={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">
            Adresse email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            required
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">
            Mot de passe
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className={fieldClass}
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="w-full gap-2 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? "Connexion en cours…" : "Se connecter"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium text-amber-400 hover:text-amber-300"
        >
          Créer un compte
        </Link>
      </p>
    </AuthShell>
  );
}
