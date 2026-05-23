"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsFormProps {
  initialName: string;
  initialShopName: string;
  initialShopifyDomain: string;
  initialWoocommerceDomain: string;
  initialLowBalanceThreshold: number;
}

export function SettingsForm({
  initialName,
  initialShopName,
  initialShopifyDomain,
  initialWoocommerceDomain,
  initialLowBalanceThreshold,
}: SettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [shopName, setShopName] = useState(initialShopName);
  const [shopifyDomain, setShopifyDomain] = useState(initialShopifyDomain);
  const [woocommerceDomain, setWoocommerceDomain] = useState(
    initialWoocommerceDomain
  );
  const [threshold, setThreshold] = useState(
    initialLowBalanceThreshold.toString()
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            shopName: shopName || null,
            shopifyDomain: shopifyDomain || null,
            woocommerceDomain: woocommerceDomain || null,
            lowBalanceThresholdFcfa: Number(threshold) || 5000,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Erreur lors de la sauvegarde.");
          return;
        }

        toast.success("Paramètres sauvegardés.");
        router.refresh();
      } catch {
        toast.error("Erreur réseau. Veuillez réessayer.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="orgName">Nom de l&apos;organisation</Label>
          <Input
            id="orgName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mon E-commerce Lomé"
          />
          <p className="text-xs text-muted-foreground">
            Nom affiché dans l&apos;interface
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="shopName">Nom de la boutique</Label>
          <Input
            id="shopName"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Ma Boutique Mode"
          />
          <p className="text-xs text-muted-foreground">
            Utilisé par l&apos;IA lors des appels de confirmation
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="shopifyDomain">Domaine Shopify</Label>
          <Input
            id="shopifyDomain"
            value={shopifyDomain}
            onChange={(e) => setShopifyDomain(e.target.value)}
            placeholder="ma-boutique.myshopify.com"
          />
          <p className="text-xs text-muted-foreground">
            Pour le routage automatique des webhooks Shopify
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="woocommerceDomain">Domaine WooCommerce</Label>
          <Input
            id="woocommerceDomain"
            value={woocommerceDomain}
            onChange={(e) => setWoocommerceDomain(e.target.value)}
            placeholder="ma-boutique.com"
          />
          <p className="text-xs text-muted-foreground">
            Pour le routage automatique des webhooks WooCommerce
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="threshold">
            Seuil d&apos;alerte solde bas (FCFA)
          </Label>
          <Input
            id="threshold"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="5000"
            min={0}
          />
          <p className="text-xs text-muted-foreground">
            Une alerte s&apos;affiche quand le solde passe sous ce seuil
          </p>
        </div>
      </div>
      <Button onClick={handleSave} disabled={isPending} className="gap-2">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Sauvegarder
      </Button>
    </div>
  );
}
