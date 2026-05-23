"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [5000, 10000, 25000, 50000, 100000];

export function StripeCheckoutButton() {
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  function handlePay() {
    const amt = parseFloat(amount);
    if (!amt || amt < 1000) {
      toast.error("Montant minimum 1 000 FCFA");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/wallet/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountFcfa: amt }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          toast.error(data.error ?? "Impossible de lancer le paiement.");
          return;
        }
        window.location.href = data.url;
      } catch {
        toast.error("Erreur réseau.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p}
            variant={amount === p.toString() ? "default" : "outline"}
            size="sm"
            onClick={() => setAmount(p.toString())}
            className="text-xs"
          >
            {p.toLocaleString("fr-TG")} F
          </Button>
        ))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="stripe-amount">Montant (FCFA)</Label>
        <Input
          id="stripe-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Ex: 25000"
          min={1000}
          inputMode="numeric"
        />
      </div>

      <Button
        onClick={handlePay}
        disabled={isPending || !amount}
        className="w-full gap-2"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        Payer par carte
      </Button>
    </div>
  );
}
