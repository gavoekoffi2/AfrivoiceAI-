"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneCall, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ManualCallButtonProps {
  orderId: string;
}

export function ManualCallButton({ orderId }: ManualCallButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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

        toast.success("Appel lancé. Le client va être contacté.");
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
      className="h-8 w-8"
      onClick={handleCall}
      disabled={isPending}
      title="Relancer un appel"
      aria-label="Relancer un appel"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <PhoneCall className="h-3 w-3" />
      )}
    </Button>
  );
}
