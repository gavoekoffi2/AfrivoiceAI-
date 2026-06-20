"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCampaignFromLeadDatabaseAction } from "@/app/actions/lead-databases";

interface CreateCampaignFromDatabaseFormProps {
  databaseId: string;
  databaseName: string;
  disabled?: boolean;
}

export function CreateCampaignFromDatabaseForm({
  databaseId,
  databaseName,
  disabled = false,
}: CreateCampaignFromDatabaseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        startTransition(async () => {
          const result = await createCampaignFromLeadDatabaseAction(formData);
          if ("error" in result && result.error) {
            toast.error(result.error);
            return;
          }
          if (!("campaignId" in result)) {
            toast.error("Campagne non créée.");
            return;
          }
          toast.success(`${result.count} prospects importés dans une nouvelle campagne.`);
          router.push(`/campaigns/${result.campaignId}`);
        });
      }}
    >
      <input type="hidden" name="databaseId" value={databaseId} />
      <Input
        name="name"
        defaultValue={`Prospection - ${databaseName}`}
        disabled={disabled || isPending}
      />
      <Textarea
        name="objective"
        defaultValue="Présenter AfrivoiceAI et qualifier les entreprises intéressées par un assistant IA qui répond aux appels clients 24/7."
        rows={3}
        disabled={disabled || isPending}
      />
      <Select name="voiceLanguage" defaultValue="fr" disabled={disabled || isPending}>
        <SelectTrigger>
          <SelectValue placeholder="Langue / voix" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fr">Français — voix francophone premium</SelectItem>
          <SelectItem value="ewe">Éwé / langue locale — démo voix africaine</SelectItem>
        </SelectContent>
      </Select>
      <Button className="w-full" disabled={disabled || isPending} type="submit">
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="mr-2 h-4 w-4" />
        )}
        Créer une campagne avec cette base
      </Button>
    </form>
  );
}
