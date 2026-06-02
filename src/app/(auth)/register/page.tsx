"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/landing/auth-shell";

const fieldClass =
  "border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-amber-400";

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await registerAction(formData);
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.message) {
        toast.success(result.message);
      }
    });
  }

  return (
    <AuthShell
      title="Créez votre compte"
      subtitle="Lancez votre première campagne d'appels IA en quelques minutes."
    >
      <form action={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="organizationName" className="text-slate-300">
            Nom de l&apos;entreprise
          </Label>
          <Input
            id="organizationName"
            name="organizationName"
            type="text"
            autoComplete="organization"
            placeholder="Mon E-commerce Lomé"
            required
            className={fieldClass}
          />
        </div>
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
            autoComplete="new-password"
            placeholder="Au moins 8 caractères"
            required
            minLength={8}
            className={fieldClass}
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="w-full gap-2 bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? "Création en cours…" : "Créer mon compte"}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Sans carte bancaire · sans engagement
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-medium text-amber-400 hover:text-amber-300"
        >
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}
