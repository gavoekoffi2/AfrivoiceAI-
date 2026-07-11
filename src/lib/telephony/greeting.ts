import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents, callLogs } from "@/lib/db/schema";
import { createTtsProvider } from "@/lib/providers/factory";
import { pcmToWav } from "@/lib/providers/stt/whisper";
import { putAudio } from "./audio-cache";

/** Synthétise le message d'accueil d'un appel (TTS seul, dégradable). */
export async function synthesizeGreeting(
  providerCallId: string,
  greeting: string
): Promise<{ audioId: string | null }> {
  const tts = createTtsProvider();
  if (!tts) return { audioId: null };

  const logRows = await db
    .select({ agentId: callLogs.agentId })
    .from(callLogs)
    .where(eq(callLogs.providerCallId, providerCallId))
    .limit(1);

  let voiceId: string | undefined;
  let language: string | undefined;
  if (logRows[0]?.agentId) {
    const agentRows = await db
      .select({ voiceId: agents.voiceId, speakLanguage: agents.speakLanguage })
      .from(agents)
      .where(eq(agents.id, logRows[0].agentId))
      .limit(1);
    voiceId = agentRows[0]?.voiceId ?? undefined;
    language = agentRows[0]?.speakLanguage;
  }

  try {
    const chunks: Uint8Array[] = [];
    let sampleRate = 24000;
    for await (const chunk of tts.synthesizeStream(
      (async function* () {
        yield greeting;
      })(),
      { voiceId, language }
    )) {
      chunks.push(chunk.data);
      sampleRate = chunk.sampleRate;
    }
    if (chunks.length === 0) return { audioId: null };

    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const pcm = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      pcm.set(c, offset);
      offset += c.length;
    }
    return { audioId: putAudio(pcmToWav(pcm, sampleRate), "audio/wav") };
  } catch (error) {
    console.error("[telephony] TTS accueil indisponible, repli <Say>:", error);
    return { audioId: null };
  }
}
