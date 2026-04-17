import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string }> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { ok: true };
  } catch (error) {
    checks.database = { ok: false, error: String(error) };
    logger.error("health", "DB check failed", { error: String(error) });
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      service: "afrivoice-ai",
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
