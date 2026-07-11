import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs } from "@/lib/db/schema";
import {
  buildAgentSystemPrompt,
  getAgent,
  listKnowledge,
} from "@/lib/services/agents";
import {
  createLlmProvider,
  createTranslationProvider,
} from "@/lib/providers/factory";
import { VoiceAgentPipeline } from "@/lib/pipeline/voice-agent-pipeline";
import { ChatMessage } from "@/lib/providers/types";
import { WidgetSessionPayload } from "@/lib/security/widget-auth";

/**
 * Tour de conversation widget (texte) : charge l'agent + l'historique,
 * exécute le LLM (+ traduction), journalise dans call_logs (canal widget).
 * Partagé par /api/widget/chat et /api/widget/voice.
 */
export async function runWidgetTurn(params: {
  session: WidgetSessionPayload;
  message: string;
  conversationId?: string;
}): Promise<
  | { ok: true; reply: string; conversationId: string; speakLanguage: string; voiceId: string | null }
  | { ok: false; status: number; error: string; message?: string }
> {
  const { session } = params;

  const agent = await getAgent(session.organizationId, session.agentId);
  if (!agent || agent.status !== "active" || !agent.widgetEnabled) {
    return { ok: false, status: 404, error: "agent_unavailable" };
  }

  // Reprise de conversation, strictement isolée par organisation + agent.
  let conversation: typeof callLogs.$inferSelect | null = null;
  if (params.conversationId) {
    const rows = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.id, params.conversationId))
      .limit(1);
    const found = rows[0];
    if (
      found &&
      found.organizationId === session.organizationId &&
      found.agentId === agent.id &&
      found.channel === "widget"
    ) {
      conversation = found;
    }
  }

  const history: ChatMessage[] = Array.isArray(conversation?.messages)
    ? conversation!.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
    : [];

  const knowledge = await listKnowledge(session.organizationId, agent.id);
  const pipeline = new VoiceAgentPipeline(
    {
      stt: { name: "unused", transcribeStream: async function* () {} },
      llm: createLlmProvider(),
      translation: createTranslationProvider(),
    },
    {
      systemPrompt: buildAgentSystemPrompt(agent, knowledge),
      model: agent.model,
      speakLanguage: agent.speakLanguage,
      thinkLanguage: agent.thinkLanguage,
      initialHistory: history,
    }
  );

  const reply = await pipeline.runTextTurn(params.message);

  const newMessages = [
    ...(Array.isArray(conversation?.messages) ? conversation!.messages : []),
    { role: "user", content: params.message, at: new Date().toISOString() },
    { role: "assistant", content: reply, at: new Date().toISOString() },
  ];

  let conversationId: string;
  if (conversation) {
    await db
      .update(callLogs)
      .set({ messages: newMessages, status: "in-progress" })
      .where(eq(callLogs.id, conversation.id));
    conversationId = conversation.id;
  } else {
    const [created] = await db
      .insert(callLogs)
      .values({
        organizationId: session.organizationId,
        agentId: agent.id,
        provider: "widget",
        direction: "inbound",
        channel: "widget",
        status: "in-progress",
        messages: newMessages,
        startedAt: new Date(),
      })
      .returning({ id: callLogs.id });
    conversationId = created.id;
  }

  return {
    ok: true,
    reply,
    conversationId,
    speakLanguage: agent.speakLanguage,
    voiceId: agent.voiceId,
  };
}
