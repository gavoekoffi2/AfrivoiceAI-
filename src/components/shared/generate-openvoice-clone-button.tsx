"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { generateOpenVoiceCloneAction } from "@/app/actions/voice-clones";
import { Button } from "@/components/ui/button";

export function GenerateOpenVoiceCloneButton({
  profileId,
  disabled,
}: {
  profileId: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled || isPending}
      className="gap-2"
      onClick={() => {
        startTransition(async () => {
          const result = await generateOpenVoiceCloneAction(profileId);
          if (result.error) {
            toast.error(result.error);
            router.refresh();
            return;
          }
          toast.success(result.message || "OpenVoice lancé.");
          router.refresh();
        });
      }}
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
      Générer OpenVoice
    </Button>
  );
}
