import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // DB
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { ok: true };
  } catch (err) {
    checks.database = { ok: false, detail: String(err).slice(0, 200) };
  }

  // Variables critiques (sans révéler leur valeur)
  const requiredEnv = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const missing = requiredEnv.filter((name) => !process.env[name]);
  checks.configuration = {
    ok: missing.length === 0,
    detail: missing.length ? `Manquant: ${missing.join(", ")}` : undefined,
  };

  // Vapi (clé présente uniquement)
  checks.vapi = {
    ok: !!process.env.VAPI_API_KEY,
    detail: !process.env.VAPI_API_KEY ? "VAPI_API_KEY non configuré" : undefined,
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      service: "afrivoice-ai",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
