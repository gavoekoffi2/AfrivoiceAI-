"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/shared/auth-shell";

export default function RegisterPage() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

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
      badge={
        <>
          <Rocket className="h-4 w-4" />
          Démarrez en 2 minutes
        </>
      }
      title="Créer un compte"
      subtitle="Inscrivez votre entreprise et lancez vos premiers appels IA dès aujourd'hui."
      footer={
        <p className="text-center text-sm text-white/45">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-violet-200 transition hover:text-white"
          >
            Se connecter
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="organizationName" className="text-white/80">
            Nom de l&apos;entreprise
          </Label>
          <Input
            id="organizationName"
            name="organizationName"
            type="text"
            autoComplete="organization"
            placeholder="Mon E-commerce Lomé"
            required
            className="h-12 rounded-2xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-violet-400"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">
            Adresse email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            required
            className="h-12 rounded-2xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-violet-400"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/80">
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
            className="h-12 rounded-2xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-violet-400"
          />
          <p className="text-xs text-white/40">
            8 caractères minimum. Utilisez un mot de passe unique.
          </p>
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="h-12 w-full rounded-2xl bg-[#756dff] text-base text-white shadow-xl shadow-violet-950/40 transition hover:bg-[#8a84ff]"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Création en cours...
            </>
          ) : (
            "Créer mon compte"
          )}
        </Button>
        <p className="text-center text-xs leading-5 text-white/35">
          En créant un compte, vous acceptez d&apos;utiliser AfrivoxAI de manière
          responsable et conforme aux règles locales de démarchage téléphonique.
        </p>
      </form>
    </AuthShell>
  );
}
