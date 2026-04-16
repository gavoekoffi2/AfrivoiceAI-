"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PhoneCall, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ManualCallButtonProps {
  orderId: string;
}

export function ManualCallButton({ orderId }: ManualCallButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleCall() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/calls/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 402) {
            toast.error(
              "Solde insuffisant. Rechargez votre wallet avant de lancer un appel."
            );
          } else {
            toast.error(data.error ?? "Impossible de lancer l'appel.");
          }
          return;
        }

        toast.success("Appel lancé ! Vapi va contacter le client dans quelques secondes.");
        // Rafraîchir pour voir le nouveau statut
        setTimeout(() => window.location.reload(), 2000);
      } catch {
        toast.error("Erreur réseau. Veuillez réessayer.");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-8 w-8"
      onClick={handleCall}
      disabled={isPending}
      title="Relancer un appel"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <PhoneCall className="h-3 w-3" />
      )}
    </Button>
  );
}
