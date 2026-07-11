/**
 * Contrats de la couche providers.
 *
 * Chaque capacité externe (STT, LLM, traduction, TTS, téléphonie) est décrite
 * par une interface. Les implémentations sont sélectionnées par configuration
 * (voir `factory.ts`). Une capacité non déployée est représentée par un stub
 * documenté qui échoue proprement — jamais une fausse implémentation.
 */

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/** Un fragment audio PCM 16 bits little-endian mono. */
export interface AudioChunk {
  data: Uint8Array;
  sampleRate: number;
  /** Horodatage relatif (ms) depuis le début du flux, si connu. */
  timestampMs?: number;
}

// ---------------------------------------------------------------------------
// STT — Speech To Text
// ---------------------------------------------------------------------------

export interface TranscriptSegment {
  text: string;
  /** `true` si le segment est final (fin d'énoncé détectée). */
  isFinal: boolean;
  /** Langue détectée ou imposée (code ISO 639-1/3). */
  language?: string;
  confidence?: number;
}

export interface SttOptions {
  /** Langue attendue (améliore la précision si connue). */
  language?: string;
  sampleRate?: number;
  signal?: AbortSignal;
}

export interface SpeechToTextProvider {
  readonly name: string;
  /**
   * Transcrit un flux audio en continu. Émet des segments partiels
   * (`isFinal: false`) puis finaux (`isFinal: true`) à chaque fin d'énoncé.
   */
  transcribeStream(
    audio: AsyncIterable<AudioChunk>,
    opts?: SttOptions
  ): AsyncIterable<TranscriptSegment>;
}

// ---------------------------------------------------------------------------
// LLM — cerveau conversationnel
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOptions {
  /** Surcharge du modèle configuré (ex. par agent). */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LLMProvider {
  readonly name: string;
  /** Complète la conversation en streaming (deltas de texte). */
  complete(
    messages: ChatMessage[],
    opts?: LlmOptions
  ): AsyncIterable<string>;
}

// ---------------------------------------------------------------------------
// Traduction
// ---------------------------------------------------------------------------

export interface TranslationProvider {
  readonly name: string;
  translate(
    text: string,
    from: string,
    to: string,
    opts?: { signal?: AbortSignal }
  ): Promise<string>;
}

// ---------------------------------------------------------------------------
// TTS — Text To Speech
// ---------------------------------------------------------------------------

export interface TtsOptions {
  /** Identifiant de voix chez le provider (ex. voix clonée OpenVoice). */
  voiceId?: string;
  language?: string;
  sampleRate?: number;
  signal?: AbortSignal;
}

export interface TextToSpeechProvider {
  readonly name: string;
  /**
   * Synthétise un flux de texte (phrases/fragments) en flux audio.
   * L'implémentation doit commencer à émettre de l'audio dès la première
   * phrase reçue (streaming), pas à la fin du texte complet.
   */
  synthesizeStream(
    text: AsyncIterable<string>,
    opts?: TtsOptions
  ): AsyncIterable<AudioChunk>;
}

// ---------------------------------------------------------------------------
// Téléphonie
// ---------------------------------------------------------------------------

export type CallDirection = "outbound" | "inbound";

export interface OutboundCallParams {
  /** Numéro appelé, format E.164 (+228...). */
  to: string;
  /** Numéro appelant (doit appartenir à l'organisation chez le provider). */
  from: string;
  /** Identifiant de l'agent qui mènera la conversation. */
  agentId: string;
  organizationId: string;
  metadata?: Record<string, string>;
}

export interface CallHandle {
  /** Identifiant de l'appel chez le provider télécom. */
  providerCallId: string;
  provider: string;
  status: string;
}

export interface InboundCallEvent {
  providerCallId: string;
  from: string;
  to: string;
  /** Payload brut du callback provider (webhook). */
  raw: Record<string, unknown>;
}

/**
 * Session média : streaming audio bidirectionnel entre le réseau télécom et
 * le pipeline vocal. Fournie par les providers qui supportent les media
 * streams temps réel (Twilio Media Streams). Africa's Talking ne fournit pas
 * de flux média brut équivalent — voir TELEPHONY.md pour la stratégie.
 */
export interface MediaSession {
  callId: string;
  /** Audio venant de l'appelant (à donner au STT). */
  incoming: AsyncIterable<AudioChunk>;
  /** Envoie de l'audio vers l'appelant (sortie du TTS). */
  send(chunk: AudioChunk): Promise<void>;
  close(): Promise<void>;
}

export interface TelephonyProvider {
  readonly name: string;
  /** Déclenche un appel sortant. */
  makeCall(params: OutboundCallParams): Promise<CallHandle>;
  /** Termine un appel en cours. */
  hangup(providerCallId: string): Promise<void>;
  /**
   * Indique si le provider supporte le streaming média bidirectionnel
   * temps réel (nécessaire pour brancher VoiceAgentPipeline en direct).
   */
  supportsMediaStreaming(): boolean;
}

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

export type PipelineStage = "stt" | "translation" | "llm" | "tts" | "telephony";

export class ProviderError extends Error {
  constructor(
    public readonly stage: PipelineStage,
    public readonly provider: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[${stage}:${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

/** Erreur levée par les stubs : capacité déclarée mais non déployée. */
export class NotDeployedError extends ProviderError {
  constructor(stage: PipelineStage, provider: string, hint: string) {
    super(stage, provider, `non déployé — ${hint}`);
    this.name = "NotDeployedError";
  }
}
