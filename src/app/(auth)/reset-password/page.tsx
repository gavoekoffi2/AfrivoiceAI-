"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";
import { resetPasswordAction } from "@/app/actions/auth";
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

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await resetPasswordAction(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result?.message ?? "Mot de passe mis à jour.");
      router.push("/login");
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
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Nouveau mot de passe</CardTitle>
            <CardDescription className="text-slate-400">
              Choisissez un nouveau mot de passe sécurisé (8 caractères min., majuscule, chiffre).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Nouveau mot de passe
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Mise à jour..." : "Mettre à jour"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
