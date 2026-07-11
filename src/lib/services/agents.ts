import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  Agent,
  AgentKnowledge,
  agentKnowledge,
  agents,
} from "@/lib/db/schema";

/**
 * Service domaine « agents » — toutes les opérations exigent explicitement
 * l'`organizationId` de la session et le combinent dans le WHERE : une
 * organisation ne peut ni lire ni modifier les agents d'une autre.
 * (Défense en profondeur supplémentaire à venir : RLS, migration 0007/0008.)
 */

export interface AgentInput {
  name: string;
  description?: string | null;
  speakLanguage?: string;
  thinkLanguage?: string;
  model?: string;
  voiceId?: string | null;
  systemPrompt: string;
  callScenario?: string | null;
  greeting?: string | null;
  status?: string;
  widgetEnabled?: boolean;
}

const ALLOWED_MODELS = new Set(["simple", "default", "premium"]);
const ALLOWED_STATUS = new Set(["draft", "active", "archived"]);

export function validateAgentInput(input: AgentInput): string | null {
  if (!input.name?.trim() || input.name.trim().length < 2) {
    return "Le nom de l'agent doit contenir au moins 2 caractères.";
  }
  if (!input.systemPrompt?.trim() || input.systemPrompt.trim().length < 10) {
    return "Les instructions (personnalité) doivent contenir au moins 10 caractères.";
  }
  if (
    input.model &&
    !ALLOWED_MODELS.has(input.model) &&
    !input.model.startsWith("claude-")
  ) {
    return "Modèle invalide : utiliser simple/default/premium ou un id de modèle Claude.";
  }
  if (input.status && !ALLOWED_STATUS.has(input.status)) {
    return "Statut invalide.";
  }
  return null;
}

export async function listAgents(organizationId: string): Promise<Agent[]> {
  return db
    .select()
    .from(agents)
    .where(eq(agents.organizationId, organizationId))
    .orderBy(desc(agents.createdAt));
}

export async function getAgent(
  organizationId: string,
  agentId: string
): Promise<Agent | null> {
  const rows = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, organizationId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAgent(
  organizationId: string,
  input: AgentInput
): Promise<Agent> {
  const [created] = await db
    .insert(agents)
    .values({
      organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      speakLanguage: input.speakLanguage ?? "fr",
      thinkLanguage: input.thinkLanguage ?? "fr",
      model: input.model ?? "default",
      voiceId: input.voiceId || null,
      systemPrompt: input.systemPrompt.trim(),
      callScenario: input.callScenario?.trim() || null,
      greeting: input.greeting?.trim() || null,
      status: input.status ?? "draft",
      widgetEnabled: input.widgetEnabled ?? false,
    })
    .returning();
  return created;
}

export async function updateAgent(
  organizationId: string,
  agentId: string,
  input: Partial<AgentInput>
): Promise<Agent | null> {
  const [updated] = await db
    .update(agents)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.speakLanguage !== undefined
        ? { speakLanguage: input.speakLanguage }
        : {}),
      ...(input.thinkLanguage !== undefined
        ? { thinkLanguage: input.thinkLanguage }
        : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.voiceId !== undefined ? { voiceId: input.voiceId || null } : {}),
      ...(input.systemPrompt !== undefined
        ? { systemPrompt: input.systemPrompt.trim() }
        : {}),
      ...(input.callScenario !== undefined
        ? { callScenario: input.callScenario?.trim() || null }
        : {}),
      ...(input.greeting !== undefined
        ? { greeting: input.greeting?.trim() || null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.widgetEnabled !== undefined
        ? { widgetEnabled: input.widgetEnabled }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, organizationId)))
    .returning();
  return updated ?? null;
}

export async function deleteAgent(
  organizationId: string,
  agentId: string
): Promise<boolean> {
  const deleted = await db
    .delete(agents)
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, organizationId)))
    .returning({ id: agents.id });
  return deleted.length > 0;
}

// --- Base de connaissances ---------------------------------------------------

export async function listKnowledge(
  organizationId: string,
  agentId: string
): Promise<AgentKnowledge[]> {
  return db
    .select()
    .from(agentKnowledge)
    .where(
      and(
        eq(agentKnowledge.agentId, agentId),
        eq(agentKnowledge.organizationId, organizationId)
      )
    )
    .orderBy(desc(agentKnowledge.createdAt));
}

export async function addKnowledge(
  organizationId: string,
  agentId: string,
  entry: { title: string; content: string; sourceUrl?: string | null }
): Promise<AgentKnowledge | null> {
  // Vérifie que l'agent appartient bien à l'organisation avant d'attacher.
  const agent = await getAgent(organizationId, agentId);
  if (!agent) return null;

  const [created] = await db
    .insert(agentKnowledge)
    .values({
      agentId,
      organizationId,
      title: entry.title.trim(),
      content: entry.content.trim(),
      sourceUrl: entry.sourceUrl?.trim() || null,
    })
    .returning();
  return created;
}

export async function deleteKnowledge(
  organizationId: string,
  knowledgeId: string
): Promise<boolean> {
  const deleted = await db
    .delete(agentKnowledge)
    .where(
      and(
        eq(agentKnowledge.id, knowledgeId),
        eq(agentKnowledge.organizationId, organizationId)
      )
    )
    .returning({ id: agentKnowledge.id });
  return deleted.length > 0;
}

// --- Prompt système effectif -------------------------------------------------

const KNOWLEDGE_CHAR_BUDGET = 12000;

/**
 * Construit le prompt système effectif d'un agent : personnalité + scénario
 * + base de connaissances (tronquée à un budget de caractères pour maîtriser
 * les coûts LLM).
 */
export function buildAgentSystemPrompt(
  agent: Pick<Agent, "systemPrompt" | "callScenario" | "name">,
  knowledge: Array<Pick<AgentKnowledge, "title" | "content">>
): string {
  const parts: string[] = [
    `Tu es « ${agent.name} », un agent vocal professionnel.`,
    agent.systemPrompt,
  ];

  if (agent.callScenario) {
    parts.push(`Scénario d'appel à suivre :\n${agent.callScenario}`);
  }

  if (knowledge.length > 0) {
    let budget = KNOWLEDGE_CHAR_BUDGET;
    const docs: string[] = [];
    for (const doc of knowledge) {
      if (budget <= 0) break;
      const content =
        doc.content.length > budget ? doc.content.slice(0, budget) : doc.content;
      budget -= content.length;
      docs.push(`### ${doc.title}\n${content}`);
    }
    parts.push(
      `Base de connaissances (réponds à partir de ces informations quand c'est pertinent ; si l'information n'y figure pas, dis-le honnêtement) :\n${docs.join("\n\n")}`
    );
  }

  parts.push(
    "Règles : réponses courtes et naturelles adaptées à l'oral (1 à 3 phrases), pas de listes ni de mise en forme, reste dans ton rôle."
  );

  return parts.join("\n\n");
}
