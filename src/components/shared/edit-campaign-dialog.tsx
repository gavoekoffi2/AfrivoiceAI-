"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  updateCampaignAction,
  deleteCampaignAction,
} from "@/app/actions/campaigns";

interface EditCampaignDialogProps {
  campaignId: string;
  initialName: string;
  initialObjective: string;
  initialScriptTemplate: string;
}

export function EditCampaignDialog({
  campaignId,
  initialName,
  initialObjective,
  initialScriptTemplate,
}: EditCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [objective, setObjective] = useState(initialObjective);
  const [scriptTemplate, setScriptTemplate] = useState(initialScriptTemplate);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      const result = await updateCampaignAction(campaignId, {
        name,
        objective,
        scriptTemplate,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Campagne mise à jour.");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (
      !confirm(
        "Supprimer cette campagne ? Tous les leads et appels associés seront aussi supprimés."
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteCampaignAction(campaignId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Campagne supprimée.");
      router.push("/dashboard/campaigns");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit className="h-4 w-4" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la campagne</DialogTitle>
          <DialogDescription>
            Mettez à jour le script et les objectifs
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nom</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-objective">Objectif</Label>
            <Input
              id="edit-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              minLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-script">Script / Prompt</Label>
            <Textarea
              id="edit-script"
              value={scriptTemplate}
              onChange={(e) => setScriptTemplate(e.target.value)}
              rows={6}
              minLength={50}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Sauvegarder
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
