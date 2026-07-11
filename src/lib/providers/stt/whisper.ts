import {
  AudioChunk,
  ProviderError,
  SpeechToTextProvider,
  SttOptions,
  TranscriptSegment,
} from "../types";

/**
 * Provider STT Whisper via un endpoint d'inférence HTTP configurable
 * (`WHISPER_API_URL`), compatible avec l'API `/v1/audio/transcriptions`
 * (faster-whisper-server, speaches, vLLM, ou OpenAI). Whisper et
 * faster-whisper sont sous licence MIT — usage commercial confirmé
 * (voir DATASETS.md).
 *
 * Streaming honnête : Whisper est un modèle par segments, pas un vrai modèle
 * incrémental. Cette implémentation fait du « streaming par fenêtres » :
 * elle accumule l'audio, détecte les fins d'énoncé par silence (VAD simple
 * par énergie), puis transcrit chaque énoncé complet. Les segments émis avec
 * `isFinal: true` correspondent aux énoncés ; il n'y a pas de partiels
 * intra-énoncé (limite documentée du modèle). Pour des partiels < 300 ms,
 * utiliser un service ASR streaming natif via un autre provider.
 */
export class WhisperSttProvider implements SpeechToTextProvider {
  readonly name = "whisper";

  constructor(
    private readonly config: {
      apiUrl?: string;
      apiKey?: string;
      model?: string;
      /** Durée de silence (ms) marquant une fin d'énoncé. */
      endOfUtteranceSilenceMs?: number;
      /** Seuil d'énergie RMS en dessous duquel un chunk est du silence. */
      silenceRmsThreshold?: number;
    } = {}
  ) {}

  private getApiUrl(): string {
    const url = this.config.apiUrl ?? process.env.WHISPER_API_URL;
    if (!url) {
      throw new ProviderError(
        "stt",
        this.name,
        "WHISPER_API_URL non configuré — déployer un serveur d'inférence Whisper (voir INTEGRATION.md)"
      );
    }
    return url.replace(/\/+$/, "");
  }

  async *transcribeStream(
    audio: AsyncIterable<AudioChunk>,
    opts: SttOptions = {}
  ): AsyncIterable<TranscriptSegment> {
    const apiUrl = this.getApiUrl(); // Vérifie la config avant de consommer l'audio.
    const silenceMs =
      this.config.endOfUtteranceSilenceMs ??
      Number(process.env.WHISPER_EOU_SILENCE_MS ?? "700");
    const rmsThreshold =
      this.config.silenceRmsThreshold ??
      Number(process.env.WHISPER_SILENCE_RMS ?? "500");

    let utterance: AudioChunk[] = [];
    let silenceAccMs = 0;
    let hasSpeech = false;

    const flush = async (): Promise<TranscriptSegment | null> => {
      if (!hasSpeech || utterance.length === 0) {
        utterance = [];
        hasSpeech = false;
        return null;
      }
      const chunks = utterance;
      utterance = [];
      hasSpeech = false;
      silenceAccMs = 0;
      const text = await this.transcribeUtterance(apiUrl, chunks, opts);
      if (!text) return null;
      return { text, isFinal: true, language: opts.language };
    };

    for await (const chunk of audio) {
      if (opts.signal?.aborted) return;
      utterance.push(chunk);

      const chunkMs =
        (chunk.data.length / 2 / (chunk.sampleRate || 16000)) * 1000;
      if (computeRms(chunk.data) < rmsThreshold) {
        silenceAccMs += chunkMs;
      } else {
        hasSpeech = true;
        silenceAccMs = 0;
      }

      // Fin d'énoncé : assez de silence après de la parole.
      if (hasSpeech && silenceAccMs >= silenceMs) {
        const segment = await flush();
        if (segment) yield segment;
      }
    }

    // Fin du flux : transcrire ce qui reste.
    const last = await flush();
    if (last) yield last;
  }

  private async transcribeUtterance(
    apiUrl: string,
    chunks: AudioChunk[],
    opts: SttOptions
  ): Promise<string> {
    const sampleRate = chunks[0]?.sampleRate ?? 16000;
    const pcm = concatChunks(chunks);
    const wav = pcmToWav(pcm, sampleRate);

    const form = new FormData();
    form.append(
      "file",
      new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }),
      "audio.wav"
    );
    form.append("model", this.config.model ?? process.env.WHISPER_MODEL ?? "large-v3");
    if (opts.language) form.append("language", opts.language);
    form.append("response_format", "json");

    const apiKey = this.config.apiKey ?? process.env.WHISPER_API_KEY;
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        body: form,
        signal: opts.signal,
      });
    } catch (error) {
      throw new ProviderError("stt", this.name, "endpoint Whisper injoignable", error);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ProviderError(
        "stt",
        this.name,
        `HTTP ${response.status} — ${detail.slice(0, 200)}`
      );
    }

    const body = (await response.json()) as { text?: string };
    return (body.text ?? "").trim();
  }
}

/** Énergie RMS d'un buffer PCM s16le. */
export function computeRms(data: Uint8Array): number {
  if (data.length < 2) return 0;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let sum = 0;
  const samples = Math.floor(data.length / 2);
  for (let i = 0; i < samples; i++) {
    const s = view.getInt16(i * 2, true);
    sum += s * s;
  }
  return Math.sqrt(sum / samples);
}

function concatChunks(chunks: AudioChunk[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.data.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c.data, offset);
    offset += c.data.length;
  }
  return out;
}

/** Encapsule du PCM s16le mono dans un container WAV minimal. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // taille du bloc fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits/sample
  writeStr(36, "data");
  view.setUint32(40, pcm.length, true);

  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}
