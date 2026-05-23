"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

export function WalletDepositButton() {
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDeposit() {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 1000) {
      toast.error("Le montant minimum est de 1 000 FCFA.");
      return;
    }

    startTransition(async () => {
      try {
        const idempotencyKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;

        const res = await fetch("/api/wallet/deposit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ amountFcfa: amountNum }),
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error ?? "Erreur lors de la recharge.");
          return;
        }

        toast.success(data.message);
        setShowForm(false);
        setAmount("");
        router.refresh();
      } catch {
        toast.error("Erreur réseau. Veuillez réessayer.");
      }
    });
  }

  if (!showForm) {
    return (
      <Button onClick={() => setShowForm(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Recharger le wallet
      </Button>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recharger le wallet</CardTitle>
        <CardDescription>
          Recharge manuelle (intégration Mobile Money à venir)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {PRESET_AMOUNTS.map((preset) => (
            <Button
              key={preset}
              variant={amount === preset.toString() ? "default" : "outline"}
              size="sm"
              onClick={() => setAmount(preset.toString())}
              className="text-xs"
            >
              {preset.toLocaleString("fr-TG")} F
            </Button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="amount">Ou saisir un montant (FCFA)</Label>
          <Input
            id="amount"
            type="number"
            placeholder="Ex: 15000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1000}
            inputMode="numeric"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleDeposit}
            disabled={isPending || !amount}
            className="flex-1 gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer la recharge
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowForm(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
