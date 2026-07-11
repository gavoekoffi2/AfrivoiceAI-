import {
  LLMProvider,
  SpeechToTextProvider,
  TextToSpeechProvider,
  TranslationProvider,
} from "./types";
import { ClaudeLLMProvider } from "./llm/claude";
import { GeminiLLMProvider } from "./llm/gemini";
import { WhisperSttProvider } from "./stt/whisper";
import {
  LlmTranslationProvider,
  NllbTranslationStub,
} from "./translation/llm-translation";
import { OpenVoiceTtsProvider } from "./tts/openvoice";

/**
 * Sélection des providers par configuration (variables d'environnement) :
 *
 * - `LLM_PROVIDER`          : "claude" (défaut) | "gemini"
 * - `STT_PROVIDER`          : "whisper" (défaut)
 * - `TTS_PROVIDER`          : "openvoice" (défaut) | "none"
 * - `TRANSLATION_PROVIDER`  : "llm" (défaut) | "nllb-stub" (NON déployable)
 *
 * Chaque provider vérifie sa propre configuration à l'usage et échoue
 * proprement si la brique n'est pas déployée (NotDeployedError /
 * ProviderError) — jamais de fausse implémentation.
 */

export function createLlmProvider(): LLMProvider {
  const name = (process.env.LLM_PROVIDER ?? "claude").toLowerCase();
  switch (name) {
    case "gemini":
      return new GeminiLLMProvider();
    case "claude":
    default:
      return new ClaudeLLMProvider();
  }
}

export function createSttProvider(): SpeechToTextProvider {
  const name = (process.env.STT_PROVIDER ?? "whisper").toLowerCase();
  switch (name) {
    case "whisper":
    default:
      return new WhisperSttProvider();
  }
}

export function createTtsProvider(): TextToSpeechProvider | undefined {
  const name = (process.env.TTS_PROVIDER ?? "openvoice").toLowerCase();
  switch (name) {
    case "none":
      return undefined; // mode texte seul (dégradé documenté)
    case "openvoice":
    default:
      return new OpenVoiceTtsProvider();
  }
}

export function createTranslationProvider(): TranslationProvider {
  const name = (process.env.TRANSLATION_PROVIDER ?? "llm").toLowerCase();
  switch (name) {
    case "nllb-stub":
      // Stub volontairement non déployé (licence CC-BY-NC, voir DATASETS.md).
      return new NllbTranslationStub();
    case "llm":
    default:
      return new LlmTranslationProvider(createLlmProvider());
  }
}
