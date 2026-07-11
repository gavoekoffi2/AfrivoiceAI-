import crypto from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents, callLogs } from "@/lib/db/schema";
import {
  atPlay,
  atRecord,
  atSay,
  buildAtVoiceResponse,
} from "@/lib/providers/telephony/africas-talking";
import {
  runPhoneTurn,
  transcribeRecording,
} from "@/lib/telephony/conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Callback voix Africa's Talking.
 *
 * Configurer dans le dashboard AT :
 *   Voice Callback URL = https://<site>/api/telephony/africas-talking/voice?token=<AFRICASTALKING_CALLBACK_TOKEN>
 *
 * Sécurité : AT ne signe pas ses callbacks voix (pas d'HMAC). La protection
 * repose sur un token secret dans l'URL, vérifié en temps constant —
 * fail-closed si non configuré. Voir TELEPHONY.md.
 *
 * Boucle de conversation tour-par-tour (AT n'a pas de media streams) :
 *   1er callback  → accueil (<Play> TTS ou <Say>) + <Record>
 *   callbacks suivants (recordingUrl) → STT → LLM → TTS → <Play> + <Record>
 *   isActive=0    → clôture du journal d'appel.
 */

function isAuthorized(req: Request): boolean {
  const configured = process.env.AFRICASTALKING_CALLBACK_TOKEN?.trim();
  if (!configured || configured.length < 16) return false; // fail-closed
  const provided = new URL(req.url).searchParams.get("token") ?? "";
  if (provided.length !== configured.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(configured));
  } catch {
    return false;
  }
}

function xml(body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}

function audioUrl(audioId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL(`/api/telephony/audio/${audioId}`, base).toString();
}

const FALLBACK_GOODBYE =
  "Une erreur technique est survenue. Merci de votre appel, au revoir.";

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return xml(buildAtVoiceResponse([atSay(FALLBACK_GOODBYE)]));
  }

  const sessionId = String(form.get("sessionId") ?? "");
  const isActive = String(form.get("isActive") ?? "0") === "1";
  const callerNumber = String(form.get("callerNumber") ?? "");
  const recordingUrl = form.get("recordingUrl")
    ? String(form.get("recordingUrl"))
    : null;
  // Pour les appels sortants, makeCall a posé `organizationId:agentId`.
  const clientRequestId = form.get("clientRequestId")
    ? String(form.get("clientRequestId"))
    : null;

  if (!sessionId) {
    return xml(buildAtVoiceResponse([atSay(FALLBACK_GOODBYE)]));
  }

  // --- Fin d'appel ------------------------------------------------------------
  if (!isActive) {
    const duration = Number(form.get("durationInSeconds") ?? "0");
    await db
      .update(callLogs)
      .set({
        status: "completed",
        durationSeconds: Number.isFinite(duration) ? duration : null,
        endedAt: new Date(),
      })
      .where(eq(callLogs.providerCallId, sessionId))
      .catch((error) => console.error("[at/voice] clôture:", error));
    return xml(buildAtVoiceResponse([]));
  }

  try {
    // --- Premier callback : accueil + enregistrement --------------------------
    if (!recordingUrl) {
      const agent = await resolveAgent(sessionId, clientRequestId, callerNumber);
      if (!agent) {
        return xml(
          buildAtVoiceResponse([
            atSay(
              "Aucun agent n'est configuré pour ce numéro. Merci de votre appel."
            ),
          ])
        );
      }

      const greeting =
        agent.greeting ??
        `Bonjour, vous êtes en ligne avec ${agent.name}. Que puis-je faire pour vous ?`;

      // Tente l'accueil en TTS (voix de l'agent), sinon <Say> de secours.
      const turn = await runPhoneTurnSafely(sessionId, null, greeting);
      const actions =
        turn?.audioId != null
          ? [atPlay(audioUrl(turn.audioId)), atRecord()]
          : [atSay(greeting), atRecord()];
      return xml(buildAtVoiceResponse(actions));
    }

    // --- Tours suivants : STT → LLM → TTS -------------------------------------
    const agentLanguage = await lookupAgentLanguage(sessionId);
    const userText = await transcribeRecording(recordingUrl, agentLanguage);

    if (!userText) {
      return xml(
        buildAtVoiceResponse([
          atSay("Je ne vous ai pas entendu. Pouvez-vous répéter ?"),
          atRecord(),
        ])
      );
    }

    const turn = await runPhoneTurn({ providerCallId: sessionId, userText });
    if (!turn) {
      return xml(buildAtVoiceResponse([atSay(FALLBACK_GOODBYE)]));
    }

    const actions =
      turn.audioId != null
        ? [atPlay(audioUrl(turn.audioId)), atRecord()]
        : [atSay(turn.text), atRecord()];
    return xml(buildAtVoiceResponse(actions));
  } catch (error) {
    console.error("[at/voice] Erreur de tour:", error);
    return xml(buildAtVoiceResponse([atSay(FALLBACK_GOODBYE)]));
  }
}

/**
 * Résout l'agent d'une session :
 * - appel sortant : `clientRequestId` = `organizationId:agentId` (posé par
 *   makeCall) — le journal d'appel existe déjà ;
 * - appel entrant : agent désigné par `AFRICASTALKING_INBOUND_AGENT_ID`
 *   (routage par numéro à venir avec la table phone_numbers) ; le journal
 *   d'appel est créé ici.
 */
async function resolveAgent(
  sessionId: string,
  clientRequestId: string | null,
  callerNumber: string
) {
  // Journal existant (appel sortant déjà enregistré par l'API).
  const existing = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.providerCallId, sessionId))
    .limit(1);
  if (existing[0]?.agentId) {
    const rows = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existing[0].agentId))
      .limit(1);
    return rows[0] ?? null;
  }

  let agentId: string | null = null;
  if (clientRequestId?.includes(":")) {
    agentId = clientRequestId.split(":")[1] ?? null;
  } else {
    agentId = process.env.AFRICASTALKING_INBOUND_AGENT_ID?.trim() || null;
  }
  if (!agentId) return null;

  const rows = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  const agent = rows[0];
  if (!agent || agent.status !== "active") return null;

  // Journal d'appel entrant.
  if (!existing[0]) {
    await db.insert(callLogs).values({
      organizationId: agent.organizationId,
      agentId: agent.id,
      provider: "africas-talking",
      providerCallId: sessionId,
      direction: "inbound",
      channel: "phone",
      phoneNumber: callerNumber || null,
      status: "in-progress",
      startedAt: new Date(),
    });
  }
  return agent;
}

async function lookupAgentLanguage(sessionId: string): Promise<string | undefined> {
  const rows = await db
    .select({ agentId: callLogs.agentId })
    .from(callLogs)
    .where(eq(callLogs.providerCallId, sessionId))
    .limit(1);
  if (!rows[0]?.agentId) return undefined;
  const agentRows = await db
    .select({ speakLanguage: agents.speakLanguage })
    .from(agents)
    .where(eq(agents.id, rows[0].agentId))
    .limit(1);
  return agentRows[0]?.speakLanguage;
}

/** Synthétise l'accueil sans énoncé utilisateur (TTS seul, dégradable). */
async function runPhoneTurnSafely(
  sessionId: string,
  _userText: string | null,
  greeting: string
): Promise<{ audioId: string | null } | null> {
  try {
    const { synthesizeGreeting } = await import("@/lib/telephony/greeting");
    return await synthesizeGreeting(sessionId, greeting);
  } catch {
    return null;
  }
}
