"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, organizations } from "@/lib/db/schema";
import { getUserSession } from "@/lib/auth";
import {
  addKnowledge,
  createAgent,
  deleteAgent,
  deleteKnowledge,
  updateAgent,
  validateAgentInput,
  type AgentInput,
} from "@/lib/services/agents";
import { generateApiKey } from "@/lib/security/api-keys";
import { generatePublicKey, normalizeDomain } from "@/lib/security/widget-auth";

type ActionResult = { success?: string; error?: string; apiKey?: string };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function agentInputFromForm(formData: FormData): AgentInput {
  return {
    name: str(formData, "name"),
    description: str(formData, "description") || null,
    speakLanguage: str(formData, "speakLanguage") || "fr",
    thinkLanguage: str(formData, "thinkLanguage") || "fr",
    model: str(formData, "model") || "default",
    voiceId: str(formData, "voiceId") || null,
    systemPrompt: str(formData, "systemPrompt"),
    callScenario: str(formData, "callScenario") || null,
    greeting: str(formData, "greeting") || null,
    status: str(formData, "status") || "draft",
    widgetEnabled: formData.get("widgetEnabled") === "on",
  };
}

export async function createAgentAction(formData: FormData): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const input = agentInputFromForm(formData);
  const validationError = validateAgentInput(input);
  if (validationError) return { error: validationError };

  try {
    await createAgent(session.organizationId, input);
    revalidatePath("/agents");
    return { success: "Agent créé." };
  } catch (error) {
    console.error("[agents] création:", error);
    return { error: "Erreur serveur lors de la création de l'agent." };
  }
}

export async function updateAgentAction(formData: FormData): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const agentId = str(formData, "agentId");
  if (!agentId) return { error: "Agent manquant." };

  const input = agentInputFromForm(formData);
  const validationError = validateAgentInput(input);
  if (validationError) return { error: validationError };

  try {
    const updated = await updateAgent(session.organizationId, agentId, input);
    if (!updated) return { error: "Agent introuvable." };
    revalidatePath("/agents");
    revalidatePath(`/agents/${agentId}`);
    return { success: "Agent mis à jour." };
  } catch (error) {
    console.error("[agents] mise à jour:", error);
    return { error: "Erreur serveur lors de la mise à jour." };
  }
}

export async function deleteAgentAction(formData: FormData): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const agentId = str(formData, "agentId");
  if (!agentId) return { error: "Agent manquant." };

  try {
    const deleted = await deleteAgent(session.organizationId, agentId);
    if (!deleted) return { error: "Agent introuvable." };
    revalidatePath("/agents");
    return { success: "Agent supprimé." };
  } catch (error) {
    console.error("[agents] suppression:", error);
    return { error: "Erreur serveur lors de la suppression." };
  }
}

export async function addKnowledgeAction(formData: FormData): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const agentId = str(formData, "agentId");
  const title = str(formData, "title");
  const content = str(formData, "content");
  if (!agentId || !title || !content) {
    return { error: "Titre et contenu requis." };
  }
  if (content.length > 100_000) {
    return { error: "Document trop long (100 000 caractères max)." };
  }

  try {
    const created = await addKnowledge(session.organizationId, agentId, {
      title,
      content,
      sourceUrl: str(formData, "sourceUrl") || null,
    });
    if (!created) return { error: "Agent introuvable." };
    revalidatePath(`/agents/${agentId}`);
    return { success: "Document ajouté à la base de connaissances." };
  } catch (error) {
    console.error("[agents] knowledge:", error);
    return { error: "Erreur serveur lors de l'ajout du document." };
  }
}

export async function deleteKnowledgeAction(formData: FormData): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const knowledgeId = str(formData, "knowledgeId");
  const agentId = str(formData, "agentId");
  if (!knowledgeId) return { error: "Document manquant." };

  try {
    const deleted = await deleteKnowledge(session.organizationId, knowledgeId);
    if (!deleted) return { error: "Document introuvable." };
    if (agentId) revalidatePath(`/agents/${agentId}`);
    return { success: "Document supprimé." };
  } catch (error) {
    console.error("[agents] knowledge suppression:", error);
    return { error: "Erreur serveur." };
  }
}

/**
 * Active le widget pour l'organisation : génère la clé publique (si absente)
 * et enregistre l'allowlist de domaines.
 */
export async function configureWidgetAction(formData: FormData): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };

  const domainsRaw = str(formData, "domains");
  const domains = domainsRaw
    .split(/[\n,;]+/)
    .map((d) => normalizeDomain(d))
    .filter((d): d is string => Boolean(d));

  if (domains.length === 0) {
    return { error: "Fournir au moins un domaine autorisé (ex. monsite.com)." };
  }

  try {
    const orgRows = await db
      .select({ publicKey: organizations.publicKey })
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1);

    await db
      .update(organizations)
      .set({
        allowedDomains: domains,
        ...(orgRows[0]?.publicKey ? {} : { publicKey: generatePublicKey() }),
      })
      .where(eq(organizations.id, session.organizationId));

    revalidatePath("/agents");
    return { success: `Widget configuré (${domains.length} domaine(s) autorisé(s)).` };
  } catch (error) {
    console.error("[agents] widget config:", error);
    return { error: "Erreur serveur lors de la configuration du widget." };
  }
}

/** Crée une clé API — la valeur complète n'est retournée qu'UNE fois. */
export async function createApiKeyAction(formData: FormData): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };
  if (!["owner", "admin", "super_admin"].includes(session.role)) {
    return { error: "Réservé au propriétaire de l'organisation." };
  }

  const name = str(formData, "name") || "Clé API";

  try {
    const { key, prefix, hash } = generateApiKey();
    await db.insert(apiKeys).values({
      organizationId: session.organizationId,
      name,
      prefix,
      hashedKey: hash,
    });
    revalidatePath("/agents");
    return {
      success:
        "Clé créée. Copiez-la MAINTENANT : elle ne sera plus jamais affichée.",
      apiKey: key,
    };
  } catch (error) {
    console.error("[agents] api key:", error);
    return { error: "Erreur serveur lors de la création de la clé." };
  }
}

export async function revokeApiKeyAction(formData: FormData): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session) return { error: "Non autorisé" };
  if (!["owner", "admin", "super_admin"].includes(session.role)) {
    return { error: "Réservé au propriétaire de l'organisation." };
  }

  const keyId = str(formData, "keyId");
  if (!keyId) return { error: "Clé manquante." };

  try {
    // Isolation tenant : le WHERE combine id + organizationId de la session,
    // une organisation ne peut pas révoquer la clé d'une autre.
    const result = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.organizationId, session.organizationId)
        )
      )
      .returning({ id: apiKeys.id });

    if (!result[0]) return { error: "Clé introuvable." };
    revalidatePath("/agents");
    return { success: "Clé révoquée." };
  } catch (error) {
    console.error("[agents] revoke:", error);
    return { error: "Erreur serveur." };
  }
}
