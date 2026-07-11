import Script from "next/script";

export const dynamic = "force-dynamic";

/**
 * Page de démonstration du widget embarquable (Partie E).
 *
 * Usage : /widget-demo?pk=pk_xxx&agent=<agentId>
 * (clé publique + id d'agent de votre organisation — voir INTEGRATION.md).
 *
 * ⚠ Pour que la démo fonctionne, le domaine de cette instance doit figurer
 * dans l'allowlist de domaines de l'organisation.
 */
export default function WidgetDemoPage({
  searchParams,
}: {
  searchParams: { pk?: string; agent?: string };
}) {
  const publicKey = searchParams.pk ?? "";
  const agentId = searchParams.agent ?? "";
  const configured = Boolean(publicKey && agentId);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 space-y-6">
      <h1 className="text-3xl font-bold">Démo — site client avec widget AfrivoiceAI</h1>
      <p className="text-muted-foreground">
        Cette page simule le site web d&apos;une entreprise cliente. Le bouton
        flottant en bas à droite est le widget AfrivoiceAI : une conversation
        texte et vocale avec l&apos;agent IA de l&apos;organisation.
      </p>

      {configured ? (
        <>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium mb-2">Snippet intégré sur cette page :</p>
            <pre className="overflow-x-auto text-xs">
              {`<script src="/widget.js" defer
  data-public-key="${publicKey.slice(0, 8)}…"
  data-agent-id="${agentId}"></script>`}
            </pre>
          </div>
          <Script
            src="/widget.js"
            strategy="afterInteractive"
            data-public-key={publicKey}
            data-agent-id={agentId}
          />
        </>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Paramètres manquants.</p>
          <p className="mt-1">
            Ouvrir cette page avec <code>?pk=&lt;clé publique&gt;&amp;agent=&lt;id agent&gt;</code>.
            La clé publique et l&apos;id d&apos;agent se trouvent dans le studio
            d&apos;agents (dashboard → Agents IA).
          </p>
        </div>
      )}

      <section className="space-y-3 pt-8 text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold text-foreground">
          Contenu fictif du site client
        </h2>
        <p>
          Boutique Lomé Élégance — vêtements et accessoires. Livraison à Lomé et
          dans tout le Togo. Paiement à la livraison disponible.
        </p>
        <p>
          Horaires : lundi–samedi, 8h–19h. Grand marché de Lomé, stand 42.
        </p>
      </section>
    </main>
  );
}
