import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { VapiClient } from "@vapi-ai/server-sdk/Client";
import type { Vapi } from "@vapi-ai/server-sdk";

export const dynamic = "force-dynamic";

const TOKEN_HASH = "1ef7d4741699aec1796d9bbd7234161b20375d618147c0a9f5bd9cbc5c8c9758";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isAuthorized(req: Request): boolean {
  const token = req.headers.get("x-test-call-token") ?? "";
  return Boolean(token) && hash(token) === TOKEN_HASH;
}

function normalizeCanadaNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\+1\d{10}$/.test(trimmed)) return null;
  return trimmed;
}

function getCreatedCallId(callResponse: Vapi.CallsCreateResponse): string {
  if ("id" in callResponse) return callResponse.id;
  const first = callResponse.results[0];
  if (!first) throw new Error("Vapi n'a retourné aucun appel créé");
  return first.id;
}

function getFrenchVoice(): Vapi.CreateAssistantDtoVoice {
  const voiceId = process.env.ELEVENLABS_FRENCH_VOICE_ID ?? process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new Error("Voix française ElevenLabs non configurée");
  }

  return {
    provider: "11labs",
    voiceId,
    model: "eleven_turbo_v2_5",
    language: "fr",
    stability: 0.55,
    similarityBoost: 0.8,
    style: 0.25,
    useSpeakerBoost: true,
    optimizeStreamingLatency: 3,
  };
}

function getClient(): VapiClient {
  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) throw new Error("VAPI_API_KEY non configuré");
  return new VapiClient({ token: apiKey });
}

function redactedError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 400);
  if (typeof error === "string") return error.slice(0, 400);
  try {
    return JSON.stringify(error).slice(0, 400);
  } catch {
    return "Erreur inconnue";
  }
}

const systemPrompt = `Tu es Marc, un assistant vocal professionnel francophone pour un cabinet de conseil au Canada.

Mission : appeler poliment une personne au Canada pour proposer un court rendez-vous de 15 minutes sur l'optimisation légale des impôts, la planification fiscale personnelle/professionnelle, et la coordination avec certaines assurances ou protections financières.

Contexte important :
- Tu ne promets jamais une réduction garantie d'impôts.
- Tu ne donnes pas de conseil fiscal personnalisé pendant cet appel.
- Tu expliques que le rendez-vous sert seulement à voir s'il existe des pistes légales à analyser.
- Tu restes professionnel, calme, respectueux, avec un français naturel adapté au Canada.
- L'objectif principal est d'obtenir un rendez-vous ou une permission de rappel.

Déroulé recommandé :
1. Te présenter brièvement.
2. Vérifier si la personne a 30 secondes.
3. Dire que tu appelles au sujet d'une courte consultation pour voir s'il existe des pistes d'optimisation fiscale légale.
4. Mentionner que cela peut concerner particuliers, travailleurs autonomes, entrepreneurs ou familles.
5. Poser une question simple : "Est-ce que vous seriez ouvert à un court rendez-vous de 15 minutes cette semaine ?"
6. Si la personne accepte, demander le meilleur moment : matin, après-midi, soir, aujourd'hui, demain, cette semaine.
7. Si la personne est occupée, proposer un rappel.
8. Si la personne refuse, remercier poliment et terminer.
9. Si c'est un mauvais numéro ou si elle demande de ne plus appeler, t'excuser et terminer immédiatement.

Règles vocales obligatoires :
- Parle uniquement en français.
- Phrases courtes, naturelles, posées.
- Ne sois jamais agressif.
- Ne coupe pas la parole.
- Si la personne demande si tu es une IA, réponds honnêtement que tu es un assistant vocal automatisé mandaté pour proposer un rendez-vous.
- Termine l'appel avec l'outil endCall dès que le prochain pas est clair ou que la personne refuse.`;

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body?.action ?? "call";
    const vapi = getClient();

    if (action === "status") {
      const callId = typeof body?.callId === "string" ? body.callId : null;
      if (!callId) return NextResponse.json({ error: "callId requis" }, { status: 400 });
      const call = await vapi.calls.get(callId);
      const callWithOptionalSummary = call as typeof call & { summary?: string | null };
      return NextResponse.json({
        success: true,
        id: call.id,
        status: call.status,
        endedReason: call.endedReason,
        summary: callWithOptionalSummary.summary,
      });
    }

    const number = normalizeCanadaNumber(body?.number);
    if (!number) {
      return NextResponse.json({ error: "Numéro canadien invalide. Format requis: +1XXXXXXXXXX" }, { status: 400 });
    }

    const callResponse = await vapi.calls.create({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
      customer: {
        number,
        name: "Contact Canada",
      },
      assistant: {
        model: {
          provider: "google",
          model: "gemini-1.5-flash",
          messages: [{ role: "system", content: systemPrompt }],
          tools: [{ type: "endCall" }],
          maxTokens: 350,
          temperature: 0.45,
        },
        voice: getFrenchVoice(),
        firstMessage:
          "Bonjour, ici Marc du cabinet de conseil. Je vous appelle rapidement au sujet d'une courte consultation pour voir s'il existe des pistes légales pour optimiser vos impôts au Canada. Est-ce que vous avez trente secondes ?",
        endCallMessage: "Merci beaucoup pour votre temps. Je vous souhaite une excellente journée.",
        artifactPlan: { recordingEnabled: true },
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "fr",
        },
      },
    });

    const callId = getCreatedCallId(callResponse);
    return NextResponse.json({ success: true, callId });
  } catch (error) {
    return NextResponse.json(
      { error: "Impossible de lancer ou lire l'appel", details: redactedError(error) },
      { status: 503 }
    );
  }
}
