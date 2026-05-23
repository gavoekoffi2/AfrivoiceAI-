"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Copy, RefreshCcw, ShoppingCart, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface WebhookUrlsProps {
  baseUrl: string;
  webhookToken: string;
  stripeConfigured: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copié dans le presse-papiers");
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copier l'URL"
      aria-label="Copier"
    >
      <Copy className={`h-3.5 w-3.5 ${copied ? "text-green-600" : ""}`} />
    </Button>
  );
}

export function WebhookUrls({
  baseUrl,
  webhookToken,
  stripeConfigured,
}: WebhookUrlsProps) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);

  const urls = [
    {
      label: "Shopify — Création de commande",
      icon: ShoppingCart,
      url: `${baseUrl}/api/webhooks/shopify?token=${webhookToken}`,
      help: "Shopify Admin → Paramètres → Notifications → Webhooks → Créer (Topic: orders/create, Format: JSON)",
    },
    {
      label: "WooCommerce — Création de commande",
      icon: ShoppingCart,
      url: `${baseUrl}/api/webhooks/woocommerce?token=${webhookToken}`,
      help: "WooCommerce → Paramètres → Avancé → Webhooks → Ajouter (Topic: Order created)",
    },
    {
      label: "Vapi.ai — Événements d'appel",
      icon: PhoneCall,
      url: `${baseUrl}/api/webhooks/vapi`,
      help: "Dashboard Vapi → Settings → Server URL",
    },
    ...(stripeConfigured
      ? [
          {
            label: "Stripe — Paiements",
            icon: ShoppingCart,
            url: `${baseUrl}/api/webhooks/stripe`,
            help: "Stripe Dashboard → Developers → Webhooks → Add endpoint (checkout.session.completed)",
          },
        ]
      : []),
  ];

  async function regenerateToken() {
    if (
      !confirm(
        "Régénérer le token invalidera vos webhooks Shopify/WooCommerce existants. Continuer ?"
      )
    )
      return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/settings/webhook-token", { method: "POST" });
      if (!res.ok) {
        toast.error("Erreur lors de la régénération.");
        return;
      }
      toast.success("Token régénéré — pensez à mettre à jour vos webhooks.");
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {urls.map((wh, i) => (
        <div key={wh.label} className="space-y-2">
          <div className="flex items-center gap-2">
            <wh.icon className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">{wh.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted p-2 text-xs font-mono break-all min-w-0">
              {wh.url}
            </code>
            <CopyButton value={wh.url} />
          </div>
          <p className="text-xs text-muted-foreground pl-1">{wh.help}</p>
          {i < urls.length - 1 && <Separator className="mt-2" />}
        </div>
      ))}

      <div className="pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={regenerateToken}
          disabled={regenerating}
          className="gap-2"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Régénérer le token webhook
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          À utiliser uniquement si vous suspectez une fuite du token.
        </p>
      </div>
    </div>
  );
}
