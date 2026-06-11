"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Pause, Loader2, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateCampaignStatusAction } from "@/app/actions/campaigns";

interface CampaignBatchCallerProps {
  campaignId: string;
  status: string;
  pendingLeads: number;
}

export function CampaignBatchCaller({
  campaignId,
  status,
  pendingLeads,
}: CampaignBatchCallerProps) {
  const [isPending, startTransition] = useTransition();
  const [isLaunching, setIsLaunching] = useState(false);
  const router = useRouter();

  function handleStatusChange(
    newStatus: "active" | "paused" | "completed" | "draft"
  ) {
    startTransition(async () => {
      const result = await updateCampaignStatusAction(campaignId, newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          newStatus === "active"
            ? "Campagne activée — les appels vont démarrer."
            : "Campagne mise en pause."
        );
      }
    });
  }

  async function launchBatchCalls() {
    if (pendingLeads === 0) {
      toast.warning("Aucun lead en attente d'appel.");
      return;
    }

    setIsLaunching(true);
    toast.info(`Lancement des appels pour ${pendingLeads} lead(s)...`);

    try {
      // Lancer les appels par lots avec délai pour éviter les rate limits
      const response = await fetch(`/api/campaigns/${campaignId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Erreur lors du lancement des appels.");
      } else if (data.remaining > 0) {
        toast.success(
          `${data.launched} appel(s) lancé(s). ${data.remaining} lead(s) restant(s) — relancez pour continuer.`
        );
      } else {
        toast.success(`${data.launched} appel(s) lancés avec succès !`);
      }
      router.refresh();
    } catch {
      toast.error("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setIsLaunching(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status === "active" ? (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || isLaunching}
            onClick={() => handleStatusChange("paused")}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            Mettre en pause
          </Button>
          <Button
            size="sm"
            disabled={isPending || isLaunching || pendingLeads === 0}
            onClick={launchBatchCalls}
            className="gap-2"
          >
            {isLaunching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PhoneCall className="h-4 w-4" />
            )}
            Lancer les appels ({pendingLeads})
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          disabled={isPending || status === "completed"}
          onClick={() => handleStatusChange("active")}
          className="gap-2"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Activer la campagne
        </Button>
      )}
    </div>
  );
}
