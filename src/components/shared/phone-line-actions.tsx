"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import {
  disablePhoneLineAction,
  setDefaultPhoneLineAction,
} from "@/app/actions/phone-lines";
import { Button } from "@/components/ui/button";

export function PhoneLineActions(props: {
  lineId: string;
  canSetDefault: boolean;
  isDefault: boolean;
  canDisable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function makeDefault() {
    startTransition(async () => {
      const result = await setDefaultPhoneLineAction(props.lineId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Ligne définie par défaut.");
      router.refresh();
    });
  }

  function disable() {
    startTransition(async () => {
      const result = await disablePhoneLineAction(props.lineId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Ligne désactivée.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {props.canSetDefault && !props.isDefault && (
        <Button size="sm" variant="outline" onClick={makeDefault} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
          Utiliser par défaut
        </Button>
      )}
      {props.canDisable && (
        <Button size="sm" variant="ghost" onClick={disable} disabled={isPending}>
          <Power className="mr-2 h-3.5 w-3.5" />
          Désactiver
        </Button>
      )}
    </div>
  );
}
