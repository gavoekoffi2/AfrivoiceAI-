"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { addManualLeadAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ManualLeadFormProps {
  campaignId: string;
}

export function ManualLeadForm({ campaignId }: ManualLeadFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addManualLeadAction(campaignId, formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (!("count" in result)) {
        toast.error("Réponse serveur inattendue.");
        return;
      }

      if (result.count === 0) {
        toast.info("Ce numéro existe déjà dans cette campagne.");
        return;
      }

      toast.success("Prospect ajouté avec succès.");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manual-lead-name">Nom du prospect</Label>
          <Input
            id="manual-lead-name"
            name="name"
            placeholder="Ex: Koffi Mensah"
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-lead-phone">Téléphone *</Label>
          <Input
            id="manual-lead-phone"
            name="phone"
            placeholder="Ex: 90 00 00 00 ou +22890000000"
            autoComplete="tel"
            required
          />
          <p className="text-xs text-muted-foreground">
            Les numéros togolais sont automatiquement convertis en +228.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manual-lead-company">Entreprise</Label>
          <Input
            id="manual-lead-company"
            name="company"
            placeholder="Ex: Boutique Afi"
            autoComplete="organization"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manual-lead-email">Email</Label>
          <Input
            id="manual-lead-email"
            name="email"
            type="email"
            placeholder="client@exemple.com"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="manual-lead-notes">Notes</Label>
        <Textarea
          id="manual-lead-notes"
          name="notes"
          placeholder="Contexte, besoin, produit proposé, créneau de rappel..."
          rows={3}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full gap-2">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        Ajouter le prospect
      </Button>
    </form>
  );
}
