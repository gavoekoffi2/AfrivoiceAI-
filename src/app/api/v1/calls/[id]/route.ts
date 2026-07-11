import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs } from "@/lib/db/schema";
import { guardPublicApi } from "@/lib/security/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/calls/:id — détail d'un appel (transcript, messages, résumé). */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await guardPublicApi(req);
  if ("response" in guard) return guard.response;

  const rows = await db
    .select()
    .from(callLogs)
    .where(
      and(
        eq(callLogs.id, params.id),
        eq(callLogs.organizationId, guard.ctx.organizationId)
      )
    )
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json(
      { error: "not_found", message: "Appel introuvable." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: rows[0] });
}
