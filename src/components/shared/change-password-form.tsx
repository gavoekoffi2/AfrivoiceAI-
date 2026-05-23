"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/app/actions/auth";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await changePasswordAction(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result?.message ?? "Mot de passe modifié.");
      const form = document.getElementById("change-password-form") as HTMLFormElement | null;
      form?.reset();
    });
  }

  return (
    <form
      id="change-password-form"
      action={handleSubmit}
      className="space-y-3 max-w-sm"
    >
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Mot de passe actuel</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          8 caractères min., majuscule et chiffre requis.
        </p>
      </div>
      <Button type="submit" disabled={isPending} className="gap-2">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        Modifier le mot de passe
      </Button>
    </form>
  );
}
