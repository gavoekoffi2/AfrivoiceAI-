"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Appel immédiat d'un lead précis depuis la liste d'une campagne.
 */
export function LeadCallButton({
  leadId,
  campaignId,
  disabled,
}: {
  leadId: string;
  campaignId: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCall() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/calls/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, campaignId }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error ?? "Impossible de lancer l'appel.");
          return;
        }

        toast.success("Appel lancé — le statut se mettra à jour automatiquement.");
        router.refresh();
      } catch {
        toast.error("Erreur réseau. Veuillez réessayer.");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={handleCall}
      disabled={disabled || isPending}
      title="Appeler ce lead maintenant"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <PhoneCall className="h-3 w-3" />
      )}
    </Button>
  );
}
