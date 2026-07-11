import {
  AudioChunk,
  ChatMessage,
  LLMProvider,
  PipelineStage,
  ProviderError,
  SpeechToTextProvider,
  TextToSpeechProvider,
  TranslationProvider,
} from "@/lib/providers/types";
import { AsyncQueue } from "./async-queue";
import { SentenceChunker } from "./sentence-chunker";

/**
 * VoiceAgentPipeline — orchestrateur de conversation vocale temps réel.
 *
 * Flux streaming (jamais séquentiel bloquant) :
 *
 *   audio entrant ──▶ STT ──(énoncé final)──▶ [traduction locale→pensée]
 *        ──▶ LLM (deltas) ──▶ découpage en phrases ──▶ [traduction pensée→locale]
 *        ──▶ TTS (audio par phrase) ──▶ audio sortant
 *
 * Tour de parole :
 * - la fin d'énoncé est signalée par le provider STT (`isFinal: true`) ;
 * - **barge-in** : si l'utilisateur parle pendant que l'agent répond, le tour
 *   en cours est annulé (AbortController propagé au LLM et au TTS) et le
 *   nouvel énoncé est traité.
 *
 * Gestion d'erreurs par étape :
 * - STT : erreur fatale → événement `error` puis fin du flux ;
 * - traduction : dégradation (texte original utilisé) + événement `error` ;
 * - LLM : le tour échoue → événement `error`, la conversation continue ;
 * - TTS : le texte reste disponible (mode dégradé texte) + événement `error`.
 */

export interface PipelineConfig {
  systemPrompt: string;
  /** Tier ("simple" | "default" | "premium") ou id de modèle complet. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Langue parlée avec l'appelant (code ISO, ex. "ee" éwé). */
  speakLanguage?: string;
  /** Langue de « pensée » du LLM (défaut : fr). Si différente de
   *  speakLanguage, la traduction est appliquée dans les deux sens. */
  thinkLanguage?: string;
  /** Voix TTS (ex. voix clonée OpenVoice). */
  voiceId?: string;
  /** Autoriser l'interruption de l'agent par l'utilisateur (défaut true). */
  allowBargeIn?: boolean;
  /** Historique initial (reprise de conversation). */
  initialHistory?: ChatMessage[];
}

export type PipelineEvent =
  | { type: "user-transcript"; text: string; isFinal: boolean }
  | { type: "agent-text"; delta: string }
  | { type: "agent-sentence"; text: string }
  | { type: "agent-audio"; chunk: AudioChunk }
  | { type: "turn-complete"; userText: string; agentText: string }
  | { type: "interrupted" }
  | { type: "error"; stage: PipelineStage; message: string; fatal: boolean };

interface Providers {
  stt: SpeechToTextProvider;
  llm: LLMProvider;
  tts?: TextToSpeechProvider;
  translation?: TranslationProvider;
}

export class VoiceAgentPipeline {
  private history: ChatMessage[];

  constructor(
    private readonly providers: Providers,
    private readonly config: PipelineConfig
  ) {
    this.history = [
      { role: "system", content: config.systemPrompt },
      ...(config.initialHistory ?? []),
    ];
  }

  /** Historique courant (pour persistance en fin d'appel). */
  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  /**
   * Traite un flux audio entrant et émet les événements de conversation.
   * Se termine quand le flux audio se termine ou sur erreur fatale.
   */
  async *run(
    audioIn: AsyncIterable<AudioChunk>,
    opts: { signal?: AbortSignal } = {}
  ): AsyncIterable<PipelineEvent> {
    const events = new AsyncQueue<PipelineEvent>();
    const allowBargeIn = this.config.allowBargeIn !== false;

    type ActiveTurn = { abort: AbortController; done: Promise<void> };
    // Muté par les callbacks de startTurn : lu via des copies typées car le
    // narrowing TS à travers l'IIFE le considérerait sinon toujours null.
    let currentTurn: ActiveTurn | null = null;
    let sttDone = false;

    const startTurn = (userText: string) => {
      const abort = new AbortController();
      const done = this.runAgentTurn(userText, events, abort.signal).catch(
        () => {}
      );
      currentTurn = { abort, done };
      void done.then(() => {
        if (currentTurn?.abort === abort) currentTurn = null;
        // Si le STT est déjà terminé et qu'aucun tour ne suit, on clôt.
        if (sttDone && currentTurn === null) events.close();
      });
    };

    // Producteur : flux STT → file d'événements + déclenchement des tours.
    const sttTask = (async () => {
      try {
        for await (const segment of this.providers.stt.transcribeStream(
          audioIn,
          { language: this.config.speakLanguage, signal: opts.signal }
        )) {
          events.push({
            type: "user-transcript",
            text: segment.text,
            isFinal: segment.isFinal,
          });

          // Barge-in : l'utilisateur parle pendant la réponse de l'agent.
          // (copies locales : le narrowing TS ne suit pas les mutations
          //  effectuées par les callbacks de startTurn)
          const speaking = currentTurn as ActiveTurn | null;
          if (speaking && allowBargeIn) {
            speaking.abort.abort();
            await speaking.done;
            events.push({ type: "interrupted" });
          }

          if (segment.isFinal && segment.text.trim()) {
            const active = currentTurn as ActiveTurn | null;
            if (active) await active.done;
            startTurn(segment.text.trim());
          }
        }
      } catch (error) {
        events.push(toErrorEvent("stt", error, true));
      } finally {
        sttDone = true;
        const turn = currentTurn as ActiveTurn | null;
        if (turn) await turn.done;
        events.close();
      }
    })();

    try {
      for await (const event of events) {
        yield event;
        if (event.type === "error" && event.fatal) break;
      }
    } finally {
      const active = currentTurn as ActiveTurn | null;
      if (active) active.abort.abort();
      await sttTask.catch(() => {});
    }
  }

  /**
   * Tour de conversation texte (widget en mode chat, tests) : même logique
   * LLM/traduction, sans STT ni TTS.
   */
  async runTextTurn(
    userText: string,
    opts: { signal?: AbortSignal } = {}
  ): Promise<string> {
    const think = await this.toThinkLanguage(userText, opts.signal);
    this.history.push({ role: "user", content: think });

    let agentThink = "";
    for await (const delta of this.providers.llm.complete(this.history, {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      signal: opts.signal,
    })) {
      agentThink += delta;
    }
    this.history.push({ role: "assistant", content: agentThink });
    return this.toSpeakLanguage(agentThink, opts.signal);
  }

  // -------------------------------------------------------------------------

  private needsTranslation(): boolean {
    const speak = this.config.speakLanguage?.toLowerCase();
    const think = (this.config.thinkLanguage ?? "fr").toLowerCase();
    return Boolean(
      speak && speak !== think && this.providers.translation
    );
  }

  private async toThinkLanguage(
    text: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.needsTranslation()) return text;
    return this.providers.translation!.translate(
      text,
      this.config.speakLanguage!,
      this.config.thinkLanguage ?? "fr",
      { signal }
    );
  }

  private async toSpeakLanguage(
    text: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.needsTranslation()) return text;
    return this.providers.translation!.translate(
      text,
      this.config.thinkLanguage ?? "fr",
      this.config.speakLanguage!,
      { signal }
    );
  }

  /** Exécute un tour complet : LLM → phrases → [traduction] → TTS. */
  private async runAgentTurn(
    userText: string,
    events: AsyncQueue<PipelineEvent>,
    signal: AbortSignal
  ): Promise<void> {
    // 1. Traduction énoncé utilisateur → langue de pensée (dégradable).
    let thinkText = userText;
    try {
      thinkText = await this.toThinkLanguage(userText, signal);
    } catch (error) {
      if (signal.aborted) return;
      events.push(toErrorEvent("translation", error, false));
    }

    this.history.push({ role: "user", content: thinkText });

    // File de phrases prêtes pour le TTS (producteur LLM / consommateur TTS
    // en parallèle : streaming réel).
    const sentences = new AsyncQueue<string>();
    const chunker = new SentenceChunker();
    let agentThink = "";
    let agentSpoken = "";

    const emitSentence = async (sentence: string) => {
      let spoken = sentence;
      try {
        spoken = await this.toSpeakLanguage(sentence, signal);
      } catch (error) {
        if (!signal.aborted) {
          events.push(toErrorEvent("translation", error, false));
        }
      }
      agentSpoken += (agentSpoken ? " " : "") + spoken;
      events.push({ type: "agent-sentence", text: spoken });
      sentences.push(spoken);
    };

    // Consommateur TTS (en parallèle de la génération LLM).
    const ttsTask = (async () => {
      if (!this.providers.tts) {
        // Pas de TTS configuré : mode texte seul, on draine la file.
        for await (const s of sentences) void s;
        return;
      }
      try {
        for await (const chunk of this.providers.tts.synthesizeStream(
          sentences,
          {
            voiceId: this.config.voiceId,
            language: this.config.speakLanguage ?? this.config.thinkLanguage,
            signal,
          }
        )) {
          if (signal.aborted) return;
          events.push({ type: "agent-audio", chunk });
        }
      } catch (error) {
        if (!signal.aborted) {
          // TTS en échec : le texte a déjà été émis (mode dégradé texte).
          events.push(toErrorEvent("tts", error, false));
          for await (const s of sentences) void s; // draine le reste
        }
      }
    })();

    // Producteur LLM.
    try {
      for await (const delta of this.providers.llm.complete(this.history, {
        model: this.config.model,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        signal,
      })) {
        if (signal.aborted) break;
        agentThink += delta;
        events.push({ type: "agent-text", delta });
        for (const sentence of chunker.push(delta)) {
          await emitSentence(sentence);
        }
      }
      const rest = chunker.flush();
      if (rest && !signal.aborted) await emitSentence(rest);
    } catch (error) {
      if (!signal.aborted) {
        events.push(toErrorEvent("llm", error, false));
      }
    } finally {
      sentences.close();
      await ttsTask;
    }

    if (signal.aborted) {
      // Tour interrompu : on conserve ce qui a été réellement dit.
      if (agentThink) {
        this.history.push({
          role: "assistant",
          content: `${agentThink} [interrompu par l'utilisateur]`,
        });
      } else {
        this.history.pop(); // rien dit : retire l'énoncé utilisateur dupliqué
      }
      return;
    }

    this.history.push({ role: "assistant", content: agentThink });
    events.push({
      type: "turn-complete",
      userText,
      agentText: agentSpoken || agentThink,
    });
  }
}

function toErrorEvent(
  stage: PipelineStage,
  error: unknown,
  fatal: boolean
): PipelineEvent {
  const message =
    error instanceof ProviderError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
  return { type: "error", stage, message: message.slice(0, 500), fatal };
}
