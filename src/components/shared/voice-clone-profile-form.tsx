"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { createVoiceCloneProfileAction } from "@/app/actions/voice-clones";
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

export function VoiceCloneProfileForm() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        startTransition(async () => {
          const result = await createVoiceCloneProfileAction(formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Profil vocal créé. Prochaine étape : génération serveur.");
          router.refresh();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Nom du profil vocal *</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ex: Voix du fondateur, Voix commerciale femme..."
          minLength={3}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider">Moteur open source ciblé</Label>
        <Select name="provider" defaultValue="openvoice" disabled={isPending}>
          <SelectTrigger id="provider">
            <SelectValue placeholder="Choisir un moteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openvoice">OpenVoice V2 — choix principal, MIT, commercial</SelectItem>
            <SelectItem value="chatterbox">Chatterbox — option B, MIT, qualité française à tester</SelectItem>
            <SelectItem value="cosyvoice">CosyVoice — avancé, Apache-2.0, plus lourd</SelectItem>
            <SelectItem value="gpt-sovits">GPT-SoVITS — studio voix, 5 sec à 1 min audio</SelectItem>
            <SelectItem value="rvc">RVC — conversion vocale entraînée</SelectItem>
            <SelectItem value="external">API externe / fournisseur premium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sampleAudioUrl">URL audio de référence</Label>
        <Input
          id="sampleAudioUrl"
          name="sampleAudioUrl"
          type="url"
          placeholder="https://.../sample.wav ou .mp3"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          MVP : on enregistre l’URL du fichier. L’upload Supabase Storage viendra juste après.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes d’usage</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Ex: voix autorisée pour appels commerciaux de l’entreprise, ton chaleureux, français + Éwé..."
          disabled={isPending}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <input
          name="consentConfirmed"
          type="checkbox"
          required
          disabled={isPending}
          className="mt-1"
        />
        <span>
          Je confirme que la voix appartient à moi ou à une personne qui a donné une autorisation explicite pour créer et utiliser ce clone vocal dans les agents AfrivoiceAI.
        </span>
      </label>

      <Button type="submit" disabled={isPending} className="w-full gap-2">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
        Créer le profil vocal sécurisé
      </Button>
    </form>
  );
}
