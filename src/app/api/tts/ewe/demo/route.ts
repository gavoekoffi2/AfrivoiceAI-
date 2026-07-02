import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { mkdir } from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";

const execFileAsync = promisify(execFile);
const DEFAULT_TEXT =
  "Ŋdi na mi. Nye nye AfrivoxAI ƒe gbe ƒe kpɔɖeŋu. Míele dɔ wɔm be míaƒe agentwo nate ŋu ado go le Eʋegbe me.";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(input: unknown) {
  const text = typeof input === "string" ? input.trim() : DEFAULT_TEXT;
  if (!text) return DEFAULT_TEXT;
  return text.slice(0, 450);
}

export async function POST(request: Request) {
  const session = await getUserSession();
  const publicDemoEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.AFRICAN_TTS_DEMO_PUBLIC === "true";

  if (!session && !publicDemoEnabled) {
    return NextResponse.json({ error: "Session requise" }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const text = cleanText(
    payload && typeof payload === "object" && "text" in payload
      ? (payload as { text?: unknown }).text
      : DEFAULT_TEXT
  );

  const cwd = process.cwd();
  const pythonPath = path.join(cwd, ".venv-african-tts", "bin", "python");
  const scriptPath = path.join(cwd, "scripts", "african_tts", "generate_ewe_demo.py");

  if (!existsSync(pythonPath) || !existsSync(scriptPath)) {
    return NextResponse.json(
      {
        error: "Le moteur TTS Éwé local n'est pas installé sur ce serveur.",
        setup:
          "uv venv .venv-african-tts && uv pip install --python .venv-african-tts/bin/python 'transformers>=4.38' torch scipy soundfile",
      },
      { status: 503 }
    );
  }

  const outputDir = path.join(os.tmpdir(), "afrivoxai-ewe-tts");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${randomUUID()}.wav`);

  try {
    const { stdout } = await execFileAsync(
      pythonPath,
      [scriptPath, "--text", text, "--output", outputPath],
      {
        cwd,
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          TOKENIZERS_PARALLELISM: "false",
        },
      }
    );

    const audio = readFileSync(outputPath);
    const metadata = JSON.parse(stdout.slice(stdout.indexOf("{")));

    return NextResponse.json({
      ok: true,
      language: "Éwé / Ewe",
      provider: "Meta MMS-TTS demo",
      model: "facebook/mms-tts-ewe",
      license: "cc-by-nc-4.0",
      commercialUse: false,
      text,
      durationHint: "~9s pour le texte par défaut",
      metadata,
      audioMimeType: "audio/wav",
      audioBase64: audio.toString("base64"),
    });
  } catch (error) {
    console.error("[tts:ewe] generation failed", error);
    return NextResponse.json(
      {
        error: "La génération audio Éwé a échoué.",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
