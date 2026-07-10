import { existsSync } from "fs";
import { mkdir, readFile, unlink } from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const DEFAULT_SAMPLE_RATE = 24000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VapiTtsPayload = {
  message?: {
    type?: string;
    text?: string;
    sampleRate?: number;
  };
};

function getSecret(request: Request) {
  return (
    request.headers.get("x-vapi-secret") ??
    request.headers.get("x-african-tts-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

function normalizeSampleRate(sampleRate: unknown) {
  if (typeof sampleRate !== "number") return DEFAULT_SAMPLE_RATE;
  return [8000, 16000, 22050, 24000, 44100].includes(sampleRate)
    ? sampleRate
    : DEFAULT_SAMPLE_RATE;
}

function cleanText(text: unknown) {
  if (typeof text !== "string") return "";
  return text.trim().slice(0, 450);
}

export async function POST(request: Request) {
  // Fail-closed : cet endpoint est appelé par Vapi (custom-voice) et exécute
  // du calcul TTS coûteux. Sans secret configuré, on refuse toute requête.
  const configuredSecret = process.env.AFRICAN_TTS_VAPI_SECRET;
  if (!configuredSecret) {
    console.error("[tts:ewe:vapi] AFRICAN_TTS_VAPI_SECRET non configuré");
    return NextResponse.json({ error: "TTS endpoint non configuré" }, { status: 503 });
  }
  if (getSecret(request) !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized TTS request" }, { status: 401 });
  }

  let payload: VapiTtsPayload;
  try {
    payload = (await request.json()) as VapiTtsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const message = payload.message;
  if (!message || message.type !== "voice-request") {
    return NextResponse.json({ error: "Invalid Vapi voice request" }, { status: 400 });
  }

  const text = cleanText(message.text);
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const sampleRate = normalizeSampleRate(message.sampleRate);
  const cwd = process.cwd();
  const pythonPath = path.join(cwd, ".venv-african-tts", "bin", "python");
  const scriptPath = path.join(cwd, "scripts", "african_tts", "generate_ewe_demo.py");

  if (!existsSync(pythonPath) || !existsSync(scriptPath)) {
    return NextResponse.json(
      { error: "Local Ewe TTS engine is not installed" },
      { status: 503 }
    );
  }

  const outputDir = path.join(os.tmpdir(), "afrivoxai-vapi-ewe-tts");
  await mkdir(outputDir, { recursive: true });
  const wavPath = path.join(outputDir, `${randomUUID()}.wav`);
  const pcmPath = path.join(outputDir, `${randomUUID()}.pcm`);

  try {
    await execFileAsync(pythonPath, [scriptPath, "--text", text, "--output", wavPath], {
      cwd,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, TOKENIZERS_PARALLELISM: "false" },
    });

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        wavPath,
        "-ac",
        "1",
        "-ar",
        String(sampleRate),
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        pcmPath,
      ],
      { timeout: 30_000 }
    );

    const pcm = await readFile(pcmPath);
    return new Response(pcm, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Audio-Format": "pcm_s16le",
        "X-Audio-Channels": "1",
        "X-Audio-Sample-Rate": String(sampleRate),
      },
    });
  } catch (error) {
    console.error("[tts:ewe:vapi] generation failed", error);
    return NextResponse.json(
      {
        error: "Ewe TTS generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await Promise.allSettled([unlink(wavPath), unlink(pcmPath)]);
  }
}
