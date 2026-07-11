import { NextResponse } from "next/server";
import * as z from "zod";
import { getAgent } from "@/lib/services/agents";
import {
  findOrganizationByPublicKey,
  isOriginAllowed,
  signWidgetSession,
} from "@/lib/security/widget-auth";
import { consumeRateLimit, ruleForPlan } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionSchema = z.object({
  publicKey: z.string().min(10).max(60),
  agentId: z.string().uuid(),
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
 * POST /api/widget/session — ouvre une session widget.
 *
 * Sécurité (Partie E) :
 * - authentification par **clé publique** d'organisation (jamais de secret
 *   côté client) ;
 * - l'`Origin` de la page hôte doit appartenir à l'**allowlist de domaines**
 *   de l'organisation — un tiers ne peut pas réutiliser le snippet ;
 * - l'agent doit être actif et explicitement exposé au widget ;
 * - rate limiting par clé publique ;
 * - en retour : token de session éphémère signé (30 min).
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers }
    );
  }
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error" },
      { status: 400, headers }
    );
  }

  const rate = consumeRateLimit(
    `widget-session:${parsed.data.publicKey}`,
    ruleForPlan("free")
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers }
    );
  }

  const organization = await findOrganizationByPublicKey(parsed.data.publicKey);
  if (!organization) {
    return NextResponse.json(
      { error: "unknown_public_key" },
      { status: 401, headers }
    );
  }

  if (!isOriginAllowed(origin, organization.allowedDomains)) {
    return NextResponse.json(
      {
        error: "origin_not_allowed",
        message:
          "Le domaine de cette page n'est pas autorisé pour ce widget. Ajouter le domaine dans les réglages de l'organisation.",
      },
      { status: 403, headers }
    );
  }

  const agent = await getAgent(organization.id, parsed.data.agentId);
  if (!agent || agent.status !== "active" || !agent.widgetEnabled) {
    return NextResponse.json(
      {
        error: "agent_unavailable",
        message: "Agent inexistant, inactif ou non exposé au widget.",
      },
      { status: 404, headers }
    );
  }

  let token: string;
  try {
    token = signWidgetSession({
      organizationId: organization.id,
      agentId: agent.id,
    });
  } catch (error) {
    // WIDGET_SESSION_SECRET absent : fail-closed avec message opérateur.
    console.error("[widget/session]", error);
    return NextResponse.json(
      { error: "widget_disabled", message: "Widget non configuré côté serveur." },
      { status: 503, headers }
    );
  }

  return NextResponse.json(
    {
      token,
      agent: {
        id: agent.id,
        name: agent.name,
        greeting:
          agent.greeting ??
          `Bonjour, je suis ${agent.name}. Comment puis-je vous aider ?`,
        speakLanguage: agent.speakLanguage,
      },
    },
    { status: 200, headers }
  );
}
