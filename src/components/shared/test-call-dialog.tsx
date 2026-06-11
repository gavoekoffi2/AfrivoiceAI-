"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhoneOutgoing, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Premier "moment magique" du produit : l'utilisateur se fait appeler par
 * l'IA sur son propre numéro pour valider que tout fonctionne.
 */
export function TestCallDialog({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!phone.trim()) {
      toast.error("Entrez votre numéro de téléphone.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/calls/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testPhone: phone, name }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error ?? "Impossible de lancer l'appel de test.");
          return;
        }

        toast.success(
          "C'est parti ! Votre téléphone va sonner dans quelques secondes. Décrochez, c'est Amina."
        );
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Erreur réseau. Veuillez réessayer.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Tester un appel IA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneOutgoing className="h-5 w-5 text-primary" />
            Recevez un appel de démonstration
          </DialogTitle>
          <DialogDescription>
            Amina, notre IA, vous appelle sur votre numéro pour vous montrer
            ce qu&apos;entendront vos prospects. L&apos;appel dure environ une
            minute.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-phone">Votre numéro de téléphone *</Label>
            <Input
              id="test-phone"
              type="tel"
              placeholder="+228 90 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Format international recommandé. Les numéros togolais sans
              indicatif sont acceptés.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-name">Votre prénom (optionnel)</Label>
            <Input
              id="test-name"
              placeholder="Ex: Koffi"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneOutgoing className="h-4 w-4" />
              )}
              M&apos;appeler maintenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
