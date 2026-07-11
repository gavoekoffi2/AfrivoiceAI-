import { NextResponse } from "next/server";
import * as z from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs } from "@/lib/db/schema";
import { guardPublicApi } from "@/lib/security/api-guard";
import { getAgent } from "@/lib/services/agents";
import {
  createTelephonyProvider,
  getOutboundPhoneNumber,
} from "@/lib/providers/telephony/factory";
import { NotDeployedError, ProviderError } from "@/lib/providers/types";
import { normalizePhoneNumber } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createCallSchema = z.object({
  agentId: z.string().uuid(),
  /** Numéro appelé (E.164 ou local TG). */
  to: z.string().min(6).max(20),
  metadata: z.record(z.string()).optional(),
});

/**
 * POST /api/v1/calls — déclenche un appel sortant mené par un agent.
 *
 * Nécessite un provider télécom configuré (Africa's Talking — voir
 * TELEPHONY.md). Sans configuration télécom, l'API répond 503 avec un
 * message actionnable : elle ne prétend JAMAIS avoir passé un appel.
 */
export async function POST(req: Request) {
  const guard = await guardPublicApi(req);
  if ("response" in guard) return guard.response;
  const { organizationId } = guard.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Corps JSON invalide." },
      { status: 400 }
    );
  }

  const parsed = createCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // L'agent doit appartenir à l'organisation ET être actif.
  const agent = await getAgent(organizationId, parsed.data.agentId);
  if (!agent) {
    return NextResponse.json(
      { error: "not_found", message: "Agent introuvable." },
      { status: 404 }
    );
  }
  if (agent.status !== "active") {
    return NextResponse.json(
      {
        error: "agent_not_active",
        message: `L'agent est en statut « ${agent.status} » — l'activer avant de lancer des appels.`,
      },
      { status: 409 }
    );
  }

  const to = normalizePhoneNumber(parsed.data.to, "TG");
  if (!to) {
    return NextResponse.json(
      { error: "invalid_phone", message: "Numéro de téléphone invalide." },
      { status: 422 }
    );
  }

  const from = getOutboundPhoneNumber();
  if (!from) {
    return NextResponse.json(
      {
        error: "telephony_not_configured",
        message:
          "Aucun numéro sortant configuré (AFRICASTALKING_PHONE_NUMBER). Voir TELEPHONY.md.",
      },
      { status: 503 }
    );
  }

  const telephony = createTelephonyProvider();
  try {
    const handle = await telephony.makeCall({
      to,
      from,
      agentId: agent.id,
      organizationId,
      metadata: parsed.data.metadata,
    });

    const [log] = await db
      .insert(callLogs)
      .values({
        organizationId,
        agentId: agent.id,
        provider: handle.provider,
        providerCallId: handle.providerCallId,
        direction: "outbound",
        channel: "phone",
        phoneNumber: to,
        status: handle.status || "queued",
        startedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ data: log }, { status: 201 });
  } catch (error) {
    if (error instanceof NotDeployedError) {
      return NextResponse.json(
        { error: "provider_not_deployed", message: error.message },
        { status: 503 }
      );
    }
    if (error instanceof ProviderError) {
      return NextResponse.json(
        { error: "telephony_error", message: error.message },
        { status: 502 }
      );
    }
    console.error("[api/v1/calls] Erreur:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Erreur serveur." },
      { status: 500 }
    );
  }
}

/** GET /api/v1/calls — journal des appels de l'organisation (paginé). */
export async function GET(req: Request) {
  const guard = await guardPublicApi(req);
  if ("response" in guard) return guard.response;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const agentId = url.searchParams.get("agentId");

  const where = agentId
    ? and(
        eq(callLogs.organizationId, guard.ctx.organizationId),
        eq(callLogs.agentId, agentId)
      )
    : eq(callLogs.organizationId, guard.ctx.organizationId);

  const rows = await db
    .select({
      id: callLogs.id,
      agentId: callLogs.agentId,
      provider: callLogs.provider,
      direction: callLogs.direction,
      channel: callLogs.channel,
      phoneNumber: callLogs.phoneNumber,
      status: callLogs.status,
      durationSeconds: callLogs.durationSeconds,
      startedAt: callLogs.startedAt,
      endedAt: callLogs.endedAt,
      createdAt: callLogs.createdAt,
    })
    .from(callLogs)
    .where(where)
    .orderBy(desc(callLogs.createdAt))
    .limit(limit);

  return NextResponse.json({ data: rows });
}
