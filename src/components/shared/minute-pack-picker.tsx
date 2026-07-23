"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { buyMinutePackAction } from "@/app/actions/minute-packs";
import { MINUTE_PACKS } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MinutePackPicker() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function buy(packCode: string) {
    startTransition(async () => {
      const result = await buyMinutePackAction(packCode);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      const reference = "reference" in result ? result.reference : undefined;
      if (!reference) {
        toast.error("La confirmation du pack est incomplète.");
        return;
      }
      toast.success(`Minutes ajoutées. Référence : ${reference}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {Object.values(MINUTE_PACKS).map((pack) => (
        <Card key={pack.code} className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary" />
              {pack.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-2xl font-bold">{pack.minutes.toLocaleString("fr-TG")} min</p>
              <p className="text-sm text-muted-foreground">
                {pack.priceFcfa.toLocaleString("fr-TG")} FCFA
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={() => buy(pack.code)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Ajouter
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
