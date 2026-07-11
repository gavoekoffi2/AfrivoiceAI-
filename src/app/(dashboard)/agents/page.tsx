import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiKeys, organizations } from "@/lib/db/schema";
import { listAgents } from "@/lib/services/agents";
import {
  configureWidgetAction,
  createAgentAction,
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/app/actions/agents";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentForm } from "@/components/shared/agent-form";
import { ApiKeyManager } from "@/components/shared/api-key-manager";
import { Bot, Globe, KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, { label: string; variant: "secondary" | "success" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  active: { label: "Actif", variant: "success" },
  archived: { label: "Archivé", variant: "outline" },
};

export default async function AgentsPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [agents, orgRows, keyRows] = await Promise.all([
    listAgents(session.organizationId),
    db
      .select({
        publicKey: organizations.publicKey,
        allowedDomains: organizations.allowedDomains,
      })
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1),
    db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, session.organizationId))
      .orderBy(desc(apiKeys.createdAt)),
  ]);
  const org = orgRows[0];

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Agents IA</h2>
        <p className="text-muted-foreground">
          Créez des agents conversationnels (téléphone + widget web) sans coder.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Liste des agents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" /> Vos agents
            </CardTitle>
            <CardDescription>
              {agents.length} agent(s) dans votre organisation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {agents.map((agent) => {
              const status = statusLabels[agent.status] ?? statusLabels.draft;
              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
                >
                  <div>
                    <span className="font-medium">{agent.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {agent.speakLanguage.toUpperCase()} · {agent.model}
                      {agent.widgetEnabled ? " · widget" : ""}
                    </span>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </Link>
              );
            })}
            {agents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun agent. Créez le premier ci-contre.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Création */}
        <Card>
          <CardHeader>
            <CardTitle>Créer un agent</CardTitle>
            <CardDescription>
              Nom, langue, personnalité, scénario — l&apos;agent est prêt en
              quelques minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentForm action={createAgentAction} submitLabel="Créer l'agent" />
          </CardContent>
        </Card>

        {/* Widget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> Widget web
            </CardTitle>
            <CardDescription>
              Clé publique + domaines autorisés à intégrer le widget sur leur site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {org?.publicKey ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Clé publique :</p>
                <code className="block break-all rounded bg-muted p-2 text-xs">
                  {org.publicKey}
                </code>
                <p className="text-xs text-muted-foreground">
                  Domaines autorisés :{" "}
                  {(org.allowedDomains ?? []).join(", ") || "aucun"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Snippet (remplacer AGENT_ID — voir INTEGRATION.md) :
                </p>
                <code className="block overflow-x-auto rounded bg-muted p-2 text-xs">
                  {`<script src="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/widget.js" defer data-public-key="${org.publicKey}" data-agent-id="AGENT_ID"></script>`}
                </code>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Widget non configuré : renseignez les domaines autorisés.
              </p>
            )}
            <form
              action={async (formData: FormData) => {
                "use server";
                await configureWidgetAction(formData);
              }}
              className="flex gap-2"
            >
              <Input
                name="domains"
                placeholder="monsite.com, boutique.tg"
                defaultValue={(org?.allowedDomains ?? []).join(", ")}
              />
              <Button type="submit" variant="outline">
                Enregistrer
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Clés API */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> API publique
            </CardTitle>
            <CardDescription>
              Clés d&apos;accès à l&apos;API REST (voir INTEGRATION.md).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeyManager
              keys={keyRows.map((k) => ({
                id: k.id,
                name: k.name,
                prefix: k.prefix,
                createdAt: k.createdAt.toISOString(),
                revokedAt: k.revokedAt?.toISOString() ?? null,
              }))}
              createAction={createApiKeyAction}
              revokeAction={revokeApiKeyAction}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
