import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession, isAuthorizedInternalCall } from "@/lib/auth";
import { triggerCall, type TriggerResult } from "@/lib/calls/trigger";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { createLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const log = createLogger("api/calls/initiate");

const bodySchema = z.union([
  z.object({ orderId: z.string().uuid(), organizationId: z.string().uuid().optional() }),
  z.object({
    leadId: z.string().uuid(),
    campaignId: z.string().uuid(),
    organizationId: z.string().uuid().optional(),
  }),
]);

function resultToResponse(result: TriggerResult) {
  if (result.success) {
    return NextResponse.json({
      success: true,
      callId: result.callId,
      vapiCallId: result.vapiCallId,
    });
  }
  const status =
    result.reason === "insufficient_balance"
      ? 402
      : result.reason === "not_found"
      ? 404
      : result.reason === "invalid_phone"
      ? 422
      : result.reason === "config_error"
      ? 503
      : 503;
  return NextResponse.json({ error: result.message }, { status });
}

export async function POST(req: Request) {
  // Rate limit anti-abus
  const ip = getClientIp(req);
  const rl = rateLimit(`calls-initiate:${ip}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: String(err) },
      { status: 400 }
    );
  }

  // 1) Appel interne (depuis un webhook) — secret partagé dédié
  if (isAuthorizedInternalCall(req)) {
    if (!body.organizationId) {
      return NextResponse.json(
        { error: "organizationId requis pour les appels internes" },
        { status: 400 }
      );
    }
    const result = await triggerCall({
      organizationId: body.organizationId,
      orderId: "orderId" in body ? body.orderId : undefined,
      leadId: "leadId" in body ? body.leadId : undefined,
      campaignId: "campaignId" in body ? body.campaignId : undefined,
    });
    return resultToResponse(result);
  }

  // 2) Appel utilisateur authentifié
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const result = await triggerCall({
    organizationId: session.organizationId,
    orderId: "orderId" in body ? body.orderId : undefined,
    leadId: "leadId" in body ? body.leadId : undefined,
    campaignId: "campaignId" in body ? body.campaignId : undefined,
  });

  log.info("Appel initié depuis dashboard", {
    userId: session.id,
    orgId: session.organizationId,
    result: result.success ? "ok" : result.reason,
  });

  return resultToResponse(result);
}
