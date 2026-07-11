import { NextResponse } from "next/server";
import { verifyWidgetSession } from "@/lib/security/widget-auth";
import { consumeRateLimit, ruleForPlan } from "@/lib/security/rate-limit";
import { runWidgetTurn } from "@/lib/widget/turn";
import { createTtsProvider } from "@/lib/providers/factory";
import { pcmToWav } from "@/lib/providers/stt/whisper";
import { ProviderError } from "@/lib/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

/**
 * POST /api/widget/voice — tour de conversation VOCAL du widget.
 *
 * multipart/form-data : `token`, `audio` (webm/ogg/wav du micro navigateur),
 * `conversationId?`.
 *
 * Chaîne : STT (endpoint Whisper configurable) → LLM (+ traduction) → TTS.
 * Dégradation honnête :
 * - STT non configuré → 503 `stt_not_configured` (le widget repasse en texte) ;
 * - TTS indisponible → réponse texte seule (`audio: null`).
 */
export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid_form" }, { status: 400, headers });
  }

  const token = String(form.get("token") ?? "");
  const conversationId = form.get("conversationId")
    ? String(form.get("conversationId"))
    : undefined;
  const audio = form.get("audio");

  const session = verifyWidgetSession(token);
  if (!session) {
    return NextResponse.json(
      { error: "invalid_session" },
      { status: 401, headers }
    );
  }
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > 10_000_000) {
    return NextResponse.json(
      { error: "invalid_audio", message: "Audio manquant ou trop volumineux (10 Mo max)." },
      { status: 400, headers }
    );
  }

  const rate = consumeRateLimit(
    `widget-voice:${session.organizationId}:${session.agentId}`,
    ruleForPlan("free")
  );
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers });
  }

  // 1. STT — endpoint Whisper configurable.
  const whisperUrl = process.env.WHISPER_API_URL?.replace(/\/+$/, "");
  if (!whisperUrl) {
    return NextResponse.json(
      {
        error: "stt_not_configured",
        message:
          "La reconnaissance vocale n'est pas déployée (WHISPER_API_URL). Utiliser le mode texte.",
      },
      { status: 503, headers }
    );
  }

  let userText = "";
  try {
    const sttForm = new FormData();
    sttForm.append("file", audio, "utterance.webm");
    sttForm.append("model", process.env.WHISPER_MODEL ?? "large-v3");
    sttForm.append("response_format", "json");
    const apiKey = process.env.WHISPER_API_KEY;
    const sttResponse = await fetch(`${whisperUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      body: sttForm,
    });
    if (!sttResponse.ok) {
      throw new Error(`STT HTTP ${sttResponse.status}`);
    }
    const sttBody = (await sttResponse.json()) as { text?: string };
    userText = (sttBody.text ?? "").trim();
  } catch (error) {
    console.error("[widget/voice] STT:", error);
    return NextResponse.json(
      { error: "stt_error", message: "Transcription impossible. Réessayer ou passer en texte." },
      { status: 502, headers }
    );
  }

  if (!userText) {
    return NextResponse.json(
      { error: "empty_transcript", message: "Aucune parole détectée." },
      { status: 422, headers }
    );
  }

  // 2. Tour LLM (+ traduction) partagé avec le chat texte.
  let result;
  try {
    result = await runWidgetTurn({ session, message: userText, conversationId });
  } catch (error) {
    const message =
      error instanceof ProviderError
        ? error.message
        : "Erreur du moteur conversationnel.";
    console.error("[widget/voice]", error);
    return NextResponse.json(
      { error: "llm_error", message },
      { status: 502, headers }
    );
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status, headers }
    );
  }

  // 3. TTS (dégradable : audio null → le widget affiche le texte).
  let audioBase64: string | null = null;
  const tts = createTtsProvider();
  if (tts) {
    try {
      const chunks: Uint8Array[] = [];
      let sampleRate = 24000;
      for await (const chunk of tts.synthesizeStream(
        (async function* () {
          yield result.reply;
        })(),
        {
          voiceId: result.voiceId ?? undefined,
          language: result.speakLanguage,
        }
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
        audioBase64 = Buffer.from(pcmToWav(pcm, sampleRate)).toString("base64");
      }
    } catch (error) {
      console.error("[widget/voice] TTS indisponible, réponse texte:", error);
    }
  }

  return NextResponse.json(
    {
      userText,
      reply: result.reply,
      conversationId: result.conversationId,
      audio: audioBase64,
      audioFormat: audioBase64 ? "wav" : null,
    },
    { status: 200, headers }
  );
}
