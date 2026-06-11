"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requeueLeadsAction } from "@/app/actions/campaigns";

/**
 * Remet les leads "sans réponse" et "à rappeler" en file d'attente pour une
 * nouvelle vague d'appels.
 */
export function RequeueLeadsButton({
  campaignId,
  count,
}: {
  campaignId: string;
  count: number;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (count === 0) return null;

  function handleRequeue() {
    startTransition(async () => {
      const result = await requeueLeadsAction(campaignId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.count} lead(s) remis en file d'attente. Lancez les appels quand vous êtes prêt.`
      );
      router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRequeue}
      disabled={isPending}
      className="gap-2"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RotateCcw className="h-4 w-4" />
      )}
      Relancer les sans-réponse ({count})
    </Button>
  );
}
