"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { purchaseLeadDatabaseAction } from "@/app/actions/lead-databases";

interface PurchaseLeadDatabaseButtonProps {
  databaseId: string;
  isPurchased: boolean;
  priceFcfa: number;
}

export function PurchaseLeadDatabaseButton({
  databaseId,
  isPurchased,
  priceFcfa,
}: PurchaseLeadDatabaseButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (isPurchased) {
    return (
      <Button variant="outline" className="w-full" disabled>
        <LockOpen className="mr-2 h-4 w-4" />
        Déjà débloquée
      </Button>
    );
  }

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await purchaseLeadDatabaseAction(databaseId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(
            priceFcfa > 0
              ? "Base achetée. Le formulaire de création de campagne est maintenant disponible."
              : "Base débloquée. Vous pouvez créer une campagne maintenant."
          );
          router.refresh();
        });
      }}
    >
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {priceFcfa > 0
        ? `Acheter et préparer campagne · ${priceFcfa.toLocaleString("fr-FR")} FCFA`
        : "Débloquer et préparer campagne"}
    </Button>
  );
}
