import { NextResponse } from "next/server";
import * as z from "zod";
import { guardPublicApi } from "@/lib/security/api-guard";
import {
  createAgent,
  listAgents,
  validateAgentInput,
} from "@/lib/services/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createAgentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  speakLanguage: z.string().min(2).max(8).optional(),
  thinkLanguage: z.string().min(2).max(8).optional(),
  model: z.string().max(60).optional(),
  voiceId: z.string().max(120).optional(),
  systemPrompt: z.string().min(10).max(20000),
  callScenario: z.string().max(20000).optional(),
  greeting: z.string().max(500).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  widgetEnabled: z.boolean().optional(),
});

/** GET /api/v1/agents — liste les agents de l'organisation. */
export async function GET(req: Request) {
  const guard = await guardPublicApi(req);
  if ("response" in guard) return guard.response;

  const agents = await listAgents(guard.ctx.organizationId);
  return NextResponse.json({ data: agents });
}

/** POST /api/v1/agents — crée un agent. */
export async function POST(req: Request) {
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

  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const validationError = validateAgentInput(parsed.data);
  if (validationError) {
    return NextResponse.json(
      { error: "validation_error", message: validationError },
      { status: 400 }
    );
  }

  const agent = await createAgent(guard.ctx.organizationId, parsed.data);
  return NextResponse.json({ data: agent }, { status: 201 });
}
