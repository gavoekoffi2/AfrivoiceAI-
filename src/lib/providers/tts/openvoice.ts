import { getOpenVoiceConfig } from "@/lib/voice-cloning/openvoice";
import {
  AudioChunk,
  ProviderError,
  TextToSpeechProvider,
  TtsOptions,
} from "../types";

/**
 * Provider TTS OpenVoice V2 (licence MIT — usage commercial confirmé,
 * voir DATASETS.md).
 *
 * Étend l'adapter OpenVoice existant (`OPENVOICE_API_URL`, jusqu'ici utilisé
 * pour le clonage `/clone`) avec la synthèse en streaming :
 *
 *   POST {OPENVOICE_API_URL}/tts
 *   body : { text, voiceId?, language?, sampleRate? }
 *   réponse : audio/pcm (s16le mono) streamé en chunked transfer.
 *
 * Le contrat du microservice est documenté dans
 * `services/openvoice-adapter/README.md`. Si le service n'est pas déployé,
 * ce provider échoue proprement avec un message actionnable (pas de fausse
 * synthèse).
 *
 * Streaming réel : chaque fragment de texte reçu (phrase) est synthétisé et
 * son audio est émis dès réception — l'audio de la phrase 1 sort pendant que
 * la phrase 2 est encore en génération LLM.
 */
export class OpenVoiceTtsProvider implements TextToSpeechProvider {
  readonly name = "openvoice";

  async *synthesizeStream(
    text: AsyncIterable<string>,
    opts: TtsOptions = {}
  ): AsyncIterable<AudioChunk> {
    const config = getOpenVoiceConfig();
    if (!config.baseUrl) {
      throw new ProviderError(
        "tts",
        this.name,
        "OPENVOICE_API_URL non configuré — déployer le microservice OpenVoice (services/openvoice-adapter)"
      );
    }

    const sampleRate = opts.sampleRate ?? 24000;

    for await (const fragment of text) {
      if (opts.signal?.aborted) return;
      const trimmed = fragment.trim();
      if (!trimmed) continue;

      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify({
            text: trimmed,
            voiceId: opts.voiceId,
            language: opts.language ?? "fr",
            sampleRate,
          }),
          signal: opts.signal,
        });
      } catch (error) {
        if (opts.signal?.aborted) return;
        throw new ProviderError(
          "tts",
          this.name,
          "service OpenVoice injoignable",
          error
        );
      }

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new ProviderError(
          "tts",
          this.name,
          `HTTP ${response.status} — ${detail.slice(0, 200)}`
        );
      }

      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (opts.signal?.aborted) return;
          if (value && value.length > 0) {
            yield { data: value, sampleRate };
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  }
}
