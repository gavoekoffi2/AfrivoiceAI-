"use client";

import { Suspense, useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginErrorListener() {
  const search = useSearchParams();
  const urlError = search.get("error");

  useEffect(() => {
    if (urlError) {
      toast.error(decodeURIComponent(urlError));
    }
  }, [urlError]);

  return null;
}

function LoginForm() {
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
    <form action={handleSubmit} className="space-y-4">
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
          className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-slate-300">
            Mot de passe
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs text-primary hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Connexion en cours..." : "Se connecter"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Suspense fallback={null}>
        <LoginErrorListener />
      </Suspense>
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex items-center justify-center rounded-full bg-primary/10 p-3">
            <PhoneCall className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white">AfrivoiceAI</h1>
          <p className="text-slate-400">
            La puissance de la Voice AI pour l&apos;Afrique
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Connexion</CardTitle>
            <CardDescription className="text-slate-400">
              Accédez à votre espace AfrivoiceAI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
