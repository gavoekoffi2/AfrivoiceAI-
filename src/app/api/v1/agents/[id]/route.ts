import { NextResponse } from "next/server";
import * as z from "zod";
import { guardPublicApi } from "@/lib/security/api-guard";
import {
  deleteAgent,
  getAgent,
  listKnowledge,
  updateAgent,
} from "@/lib/services/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateAgentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  speakLanguage: z.string().min(2).max(8).optional(),
  thinkLanguage: z.string().min(2).max(8).optional(),
  model: z.string().max(60).optional(),
  voiceId: z.string().max(120).nullable().optional(),
  systemPrompt: z.string().min(10).max(20000).optional(),
  callScenario: z.string().max(20000).nullable().optional(),
  greeting: z.string().max(500).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  widgetEnabled: z.boolean().optional(),
});

type Params = { params: { id: string } };

/** GET /api/v1/agents/:id — détail + base de connaissances. */
export async function GET(req: Request, { params }: Params) {
  const guard = await guardPublicApi(req);
  if ("response" in guard) return guard.response;

  const agent = await getAgent(guard.ctx.organizationId, params.id);
  if (!agent) {
    return NextResponse.json(
      { error: "not_found", message: "Agent introuvable." },
      { status: 404 }
    );
  }
  const knowledge = await listKnowledge(guard.ctx.organizationId, params.id);
  return NextResponse.json({ data: { ...agent, knowledge } });
}

/** PATCH /api/v1/agents/:id — mise à jour partielle. */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await guardPublicApi(req);
  if ("response" in guard) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Corps JSON invalide." },
      { status: 400 }
    );
  }

  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateAgent(
    guard.ctx.organizationId,
    params.id,
    parsed.data
  );
  if (!updated) {
    return NextResponse.json(
      { error: "not_found", message: "Agent introuvable." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: updated });
}

/** DELETE /api/v1/agents/:id */
export async function DELETE(req: Request, { params }: Params) {
  const guard = await guardPublicApi(req);
  if ("response" in guard) return guard.response;

  const deleted = await deleteAgent(guard.ctx.organizationId, params.id);
  if (!deleted) {
    return NextResponse.json(
      { error: "not_found", message: "Agent introuvable." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: { deleted: true } });
}
