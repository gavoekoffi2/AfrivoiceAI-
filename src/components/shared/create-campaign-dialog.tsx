"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createCampaignAction } from "@/app/actions/campaigns";

export function CreateCampaignDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createCampaignAction(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Campagne créée avec succès !");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Nouvelle campagne
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Créer une nouvelle campagne</CardTitle>
          <CardDescription>
            Configurez votre campagne de prospection automatisée
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la campagne *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Ex: Prospection PME Lomé Q1 2025"
                required
                minLength={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objective">Objectif *</Label>
              <Input
                id="objective"
                name="objective"
                placeholder="Ex: Prendre un rendez-vous de démonstration"
                required
                minLength={10}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scriptTemplate">
                Script / Prompt de l&apos;IA *
              </Label>
              <Textarea
                id="scriptTemplate"
                name="scriptTemplate"
                placeholder={`Ex: Tu es un commercial de AfrivoiceAI. Tu appelles {leadName} de {entreprise} pour présenter notre solution de Voice AI...`}
                required
                minLength={50}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles : {"{leadName}"}, {"{entreprise}"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer la campagne
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
