import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { voiceCloneProfiles } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CallbackPayload = {
  profileId?: string;
  status?: "queued" | "training" | "ready" | "failed";
  voiceId?: string;
  previewAudioUrl?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

function isAuthorized(request: NextRequest) {
  const secret = process.env.OPENVOICE_CALLBACK_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  return token === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: CallbackPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const status = payload.status === "ready" || payload.status === "failed" || payload.status === "training"
    ? payload.status
    : "training";

  const existing = await db.query.voiceCloneProfiles.findFirst({
    where: eq(voiceCloneProfiles.id, payload.profileId),
  });
  if (!existing) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  await db
    .update(voiceCloneProfiles)
    .set({
      status,
      externalVoiceId: payload.voiceId || existing.externalVoiceId,
      metadata: {
        ...(typeof existing.metadata === "object" && existing.metadata ? existing.metadata : {}),
        engine: "openvoice-v2",
        callbackAt: new Date().toISOString(),
        previewAudioUrl: payload.previewAudioUrl,
        serviceMessage: payload.message,
        serviceMetadata: payload.metadata,
      },
      updatedAt: new Date(),
    })
    .where(eq(voiceCloneProfiles.id, existing.id));

  return NextResponse.json({ ok: true, status });
}
