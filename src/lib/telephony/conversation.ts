import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents, callLogs } from "@/lib/db/schema";
import { buildAgentSystemPrompt, listKnowledge } from "@/lib/services/agents";
import {
  createLlmProvider,
  createTranslationProvider,
  createTtsProvider,
} from "@/lib/providers/factory";
import { VoiceAgentPipeline } from "@/lib/pipeline/voice-agent-pipeline";
import { pcmToWav } from "@/lib/providers/stt/whisper";
import { ChatMessage, ProviderError } from "@/lib/providers/types";
import { putAudio } from "./audio-cache";

/**
 * Logique de conversation téléphonique tour-par-tour (Africa's Talking).
 *
 * AT ne fournissant pas de media streams temps réel, chaque tour est :
 * enregistrement de l'appelant → STT (fichier) → LLM (+traduction) → TTS →
 * audio servi en <Play>. Voir TELEPHONY.md §Latence.
 */

export interface TurnResult {
  /** Texte de la réponse de l'agent (langue parlée). */
  text: string;
  /** Id d'audio TTS en cache, si la synthèse a réussi. */
  audioId: string | null;
}

/** Transcrit un enregistrement hébergé (URL AT) via l'endpoint Whisper. */
export async function transcribeRecording(
  recordingUrl: string,
  language?: string
): Promise<string> {
  const apiUrl = process.env.WHISPER_API_URL?.replace(/\/+$/, "");
  if (!apiUrl) {
    throw new ProviderError(
      "stt",
      "whisper",
      "WHISPER_API_URL non configuré — impossible de transcrire l'enregistrement"
    );
  }

  const audioResponse = await fetch(recordingUrl);
  if (!audioResponse.ok) {
    throw new ProviderError(
      "stt",
      "whisper",
      `téléchargement de l'enregistrement impossible (HTTP ${audioResponse.status})`
    );
  }
  const audioBytes = new Uint8Array(await audioResponse.arrayBuffer());

  const form = new FormData();
  form.append(
    "file",
    new Blob([audioBytes.buffer as ArrayBuffer], {
      type: audioResponse.headers.get("content-type") ?? "audio/mpeg",
    }),
    "recording.mp3"
  );
  form.append("model", process.env.WHISPER_MODEL ?? "large-v3");
  if (language) form.append("language", language);
  form.append("response_format", "json");

  const apiKey = process.env.WHISPER_API_KEY;
  const response = await fetch(`${apiUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new ProviderError(
      "stt",
      "whisper",
      `HTTP ${response.status} — ${detail.slice(0, 200)}`
    );
  }
  const body = (await response.json()) as { text?: string };
  return (body.text ?? "").trim();
}

/** Charge l'agent + son journal d'appel, exécute un tour, persiste l'historique. */
export async function runPhoneTurn(params: {
  providerCallId: string;
  userText: string;
}): Promise<TurnResult | null> {
  const logRows = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.providerCallId, params.providerCallId))
    .limit(1);
  const log = logRows[0];
  if (!log || !log.agentId) return null;

  const agentRows = await db
    .select()
    .from(agents)
    .where(eq(agents.id, log.agentId))
    .limit(1);
  const agent = agentRows[0];
  if (!agent || agent.organizationId !== log.organizationId) return null;

  const knowledge = await listKnowledge(agent.organizationId, agent.id);
  const history: ChatMessage[] = Array.isArray(log.messages)
    ? log.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
    : [];

  const pipeline = new VoiceAgentPipeline(
    {
      stt: {
        // Le STT du tour est fait en amont (fichier) — jamais appelé ici.
        name: "unused",
        transcribeStream: async function* () {},
      },
      llm: createLlmProvider(),
      translation: createTranslationProvider(),
      tts: createTtsProvider(),
    },
    {
      systemPrompt: buildAgentSystemPrompt(agent, knowledge),
      model: agent.model,
      speakLanguage: agent.speakLanguage,
      thinkLanguage: agent.thinkLanguage,
      voiceId: agent.voiceId ?? undefined,
      initialHistory: history,
    }
  );

  const text = await pipeline.runTextTurn(params.userText);

  // Synthèse TTS de la réponse (dégradable : texte seul si TTS indisponible).
  let audioId: string | null = null;
  const tts = createTtsProvider();
  if (tts && text) {
    try {
      const chunks: Uint8Array[] = [];
      let sampleRate = 24000;
      for await (const chunk of tts.synthesizeStream(
        (async function* () {
          yield text;
        })(),
        { voiceId: agent.voiceId ?? undefined, language: agent.speakLanguage }
      )) {
        chunks.push(chunk.data);
        sampleRate = chunk.sampleRate;
      }
      if (chunks.length > 0) {
        const total = chunks.reduce((acc, c) => acc + c.length, 0);
        const pcm = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
          pcm.set(c, offset);
          offset += c.length;
        }
        audioId = putAudio(pcmToWav(pcm, sampleRate), "audio/wav");
      }
    } catch (error) {
      console.error("[telephony] TTS indisponible, repli texte:", error);
    }
  }

  // Persistance de l'historique (transcript incrémental).
  const newMessages = [
    ...(Array.isArray(log.messages) ? log.messages : []),
    { role: "user", content: params.userText, at: new Date().toISOString() },
    { role: "assistant", content: text, at: new Date().toISOString() },
  ];
  await db
    .update(callLogs)
    .set({
      messages: newMessages,
      transcript: newMessages
        .map((m) => `${m.role === "user" ? "Client" : "Agent"}: ${m.content}`)
        .join("\n"),
      status: "in-progress",
    })
    .where(eq(callLogs.id, log.id));

  return { text, audioId };
}
