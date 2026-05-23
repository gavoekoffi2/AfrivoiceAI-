"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";
import { forgotPasswordAction } from "@/app/actions/auth";
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

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await forgotPasswordAction(formData);
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
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex items-center justify-center rounded-full bg-primary/10 p-3">
            <PhoneCall className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white">AfrivoiceAI</h1>
          <p className="text-slate-400">Récupération de mot de passe</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Mot de passe oublié ?</CardTitle>
            <CardDescription className="text-slate-400">
              Entrez votre email — nous vous enverrons un lien de réinitialisation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Envoi en cours..." : "Envoyer le lien"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-400">
          <Link href="/login" className="text-primary hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
