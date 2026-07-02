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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle campagne
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle campagne</DialogTitle>
          <DialogDescription>
            Configurez votre campagne de prospection automatisée
          </DialogDescription>
        </DialogHeader>
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
            <Label htmlFor="voiceLanguage">Langue / voix de l&apos;agent *</Label>
            <Select name="voiceLanguage" defaultValue="fr">
              <SelectTrigger id="voiceLanguage">
                <SelectValue placeholder="Choisir une langue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français — voix francophone premium</SelectItem>
                <SelectItem value="ewe">Éwé / langue locale — démo voix africaine</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Le français reste disponible. La langue locale est proposée comme option selon la campagne.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scriptTemplate">
              Script / Prompt de l&apos;IA *
            </Label>
            <Textarea
              id="scriptTemplate"
              name="scriptTemplate"
              placeholder={`Ex: Tu es un commercial de AfrivoxAI. Tu appelles {leadName} de {entreprise} pour présenter notre solution de Voice AI...`}
              required
              minLength={50}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Variables disponibles : {"{leadName}"}, {"{entreprise}"}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer la campagne
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
