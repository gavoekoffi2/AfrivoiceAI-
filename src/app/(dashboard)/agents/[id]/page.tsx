import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { getAgent, listKnowledge } from "@/lib/services/agents";
import {
  addKnowledgeAction,
  deleteAgentAction,
  deleteKnowledgeAction,
  updateAgentAction,
} from "@/app/actions/agents";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AgentForm } from "@/components/shared/agent-form";
import { ArrowLeft, BookOpen, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const agent = await getAgent(session.organizationId, params.id);
  if (!agent) notFound();

  const [knowledge, orgRows] = await Promise.all([
    listKnowledge(session.organizationId, agent.id),
    db
      .select({ publicKey: organizations.publicKey })
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1),
  ]);
  const publicKey = orgRows[0]?.publicKey;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link href="/agents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Agents
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">{agent.name}</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Modifier la personnalité, la langue, le modèle et le statut.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgentForm
              agent={agent}
              action={updateAgentAction}
              submitLabel="Enregistrer"
            />
            <form
              action={async (formData: FormData) => {
                "use server";
                await deleteAgentAction(formData);
              }}
              className="mt-4"
            >
              <input type="hidden" name="agentId" value={agent.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="mr-1 h-4 w-4" /> Supprimer l&apos;agent
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" /> Base de connaissances
              </CardTitle>
              <CardDescription>
                Documents que l&apos;agent consulte pour répondre (horaires,
                tarifs, procédures…).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {knowledge.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <span className="font-medium">{doc.title}</span>
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        await deleteKnowledgeAction(formData);
                      }}
                    >
                      <input type="hidden" name="knowledgeId" value={doc.id} />
                      <input type="hidden" name="agentId" value={agent.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </li>
                ))}
                {knowledge.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Aucun document.
                  </li>
                )}
              </ul>

              <form
                action={async (formData: FormData) => {
                  "use server";
                  await addKnowledgeAction(formData);
                }}
                className="space-y-2"
              >
                <input type="hidden" name="agentId" value={agent.id} />
                <Input name="title" placeholder="Titre (ex. Horaires et tarifs)" required />
                <Textarea
                  name="content"
                  rows={4}
                  placeholder="Collez ici le contenu que l'agent doit connaître…"
                  required
                />
                <Input name="sourceUrl" placeholder="URL source (optionnel)" />
                <Button type="submit" variant="outline">
                  Ajouter le document
                </Button>
              </form>
            </CardContent>
          </Card>

          {agent.widgetEnabled && publicKey && (
            <Card>
              <CardHeader>
                <CardTitle>Snippet widget de cet agent</CardTitle>
                <CardDescription>
                  À coller sur le site de l&apos;entreprise (domaine autorisé requis).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <code className="block overflow-x-auto rounded bg-muted p-2 text-xs">
                  {`<script src="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/widget.js" defer data-public-key="${publicKey}" data-agent-id="${agent.id}"></script>`}
                </code>
                <Link
                  href={`/widget-demo?pk=${publicKey}&agent=${agent.id}`}
                  className="text-xs text-primary underline"
                  target="_blank"
                >
                  Voir la page de démo →
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
