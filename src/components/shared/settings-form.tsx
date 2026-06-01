"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SettingsFormProps {
  organizationId: string;
  initialName: string;
  initialShopName: string;
  initialShopDomain: string;
}

export function SettingsForm({
  organizationId,
  initialName,
  initialShopName,
  initialShopDomain,
}: SettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [shopName, setShopName] = useState(initialShopName);
  const [shopDomain, setShopDomain] = useState(initialShopDomain);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, shopName, shopDomain }),
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error ?? "Erreur lors de la sauvegarde.");
          return;
        }

        toast.success("Paramètres sauvegardés avec succès !");
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
            Nom affiché dans l&apos;interface et les rapports
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
      </div>
      <div className="space-y-2">
        <Label htmlFor="shopDomain">Domaine de la boutique</Label>
        <Input
          id="shopDomain"
          value={shopDomain}
          onChange={(e) => setShopDomain(e.target.value)}
          placeholder="ma-boutique.myshopify.com"
        />
        <p className="text-xs text-muted-foreground">
          Indispensable en multi-boutiques : permet d&apos;aiguiller les
          webhooks Shopify/WooCommerce vers la bonne organisation.
        </p>
      </div>
      <Button
        onClick={handleSave}
        disabled={isPending}
        className="gap-2"
      >
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
