import { NextResponse } from "next/server";
import * as z from "zod";
import { verifyWidgetSession } from "@/lib/security/widget-auth";
import { consumeRateLimit, ruleForPlan } from "@/lib/security/rate-limit";
import { runWidgetTurn } from "@/lib/widget/turn";
import { ProviderError } from "@/lib/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatSchema = z.object({
  token: z.string().min(20),
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});

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
 * POST /api/widget/chat — tour de conversation texte avec l'agent.
 * Authentifié par le token de session éphémère délivré par /api/widget/session.
 */
export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers });
  }
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error" },
      { status: 400, headers }
    );
  }

  const session = verifyWidgetSession(parsed.data.token);
  if (!session) {
    return NextResponse.json(
      { error: "invalid_session", message: "Session expirée — recharger le widget." },
      { status: 401, headers }
    );
  }

  const rate = consumeRateLimit(
    `widget-chat:${session.organizationId}:${session.agentId}`,
    ruleForPlan("free")
  );
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers });
  }

  try {
    const result = await runWidgetTurn({
      session,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status, headers }
      );
    }
    return NextResponse.json(
      { reply: result.reply, conversationId: result.conversationId },
      { status: 200, headers }
    );
  } catch (error) {
    const message =
      error instanceof ProviderError
        ? error.message
        : "Erreur du moteur conversationnel.";
    console.error("[widget/chat]", error);
    return NextResponse.json(
      { error: "llm_error", message },
      { status: 502, headers }
    );
  }
}
