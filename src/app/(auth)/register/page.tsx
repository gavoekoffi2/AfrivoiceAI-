"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";
import { registerAction } from "@/app/actions/auth";
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex items-center justify-center rounded-full bg-primary/10 p-3">
            <PhoneCall className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white">AfrivoiceAI</h1>
          <p className="text-slate-400">Commencez à automatiser vos appels dès aujourd&apos;hui</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Créer un compte</CardTitle>
            <CardDescription className="text-slate-400">
              Inscrivez votre entreprise sur AfrivoiceAI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organizationName" className="text-slate-300">
                  Nom de l&apos;entreprise
                </Label>
                <Input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  placeholder="Mon E-commerce Lomé"
                  required
                  className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
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
                  placeholder="vous@exemple.com"
                  required
                  className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
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
                  placeholder="Au moins 8 caractères"
                  required
                  minLength={8}
                  className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? "Création en cours..." : "Créer mon compte"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
