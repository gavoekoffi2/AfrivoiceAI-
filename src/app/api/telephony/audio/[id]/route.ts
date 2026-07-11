import { NextResponse } from "next/server";
import { getAudio } from "@/lib/telephony/audio-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sert les audios TTS générés pour les réponses <Play> d'Africa's Talking.
 * Les identifiants sont des UUID aléatoires à durée de vie courte (10 min) :
 * non devinables, non listables, expirés après l'appel.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const audio = getAudio(params.id);
  if (!audio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = new Uint8Array(audio.data);
  return new NextResponse(body.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": audio.contentType,
      "Content-Length": String(audio.data.length),
      "Cache-Control": "no-store",
    },
  });
}
