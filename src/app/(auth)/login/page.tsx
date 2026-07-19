"use client";

import { Suspense, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/shared/auth-shell";

function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {redirectTo && (
        <input type="hidden" name="redirect" value={redirectTo} />
      )}
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
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="h-12 rounded-2xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-violet-400"
        />
      </div>
      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-2xl bg-[#756dff] text-base text-white shadow-xl shadow-violet-950/40 transition hover:bg-[#8a84ff]"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connexion en cours...
          </>
        ) : (
          "Se connecter"
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      badge={
        <>
          <Sparkles className="h-4 w-4" />
          Ravi de vous revoir
        </>
      }
      title="Connexion"
      subtitle="Accédez à votre espace AfrivoxAI et pilotez vos appels IA."
      footer={
        <p className="text-center text-sm text-white/45">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="font-medium text-violet-200 transition hover:text-white"
          >
            Créer un compte
          </Link>
        </p>
      }
    >
      <Suspense
        fallback={
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
