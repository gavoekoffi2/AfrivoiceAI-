import { describe, expect, it } from "vitest";
import { VoiceAgentPipeline, PipelineEvent } from "./voice-agent-pipeline";
import {
  AudioChunk,
  LLMProvider,
  ProviderError,
  SpeechToTextProvider,
  TextToSpeechProvider,
  TranscriptSegment,
  TranslationProvider,
} from "@/lib/providers/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeStt(script: Array<TranscriptSegment | number>): SpeechToTextProvider {
  return {
    name: "mock-stt",
    async *transcribeStream() {
      for (const step of script) {
        if (typeof step === "number") await sleep(step);
        else yield step;
      }
    },
  };
}

function makeLlm(
  deltas: string[],
  opts: { delayMs?: number; failAfter?: number } = {}
): LLMProvider {
  return {
    name: "mock-llm",
    async *complete(_messages, llmOpts) {
      let i = 0;
      for (const delta of deltas) {
        if (llmOpts?.signal?.aborted) return;
        if (opts.failAfter !== undefined && i >= opts.failAfter) {
          throw new ProviderError("llm", "mock-llm", "panne simulée");
        }
        if (opts.delayMs) await sleep(opts.delayMs);
        yield delta;
        i++;
      }
    },
  };
}

function makeTts(opts: { fail?: boolean } = {}): TextToSpeechProvider {
  return {
    name: "mock-tts",
    async *synthesizeStream(text, ttsOpts) {
      for await (const sentence of text) {
        if (ttsOpts?.signal?.aborted) return;
        if (opts.fail) {
          throw new ProviderError("tts", "mock-tts", "TTS indisponible");
        }
        yield {
          data: new Uint8Array(Buffer.from(sentence)),
          sampleRate: 24000,
        } satisfies AudioChunk;
      }
    },
  };
}

const echoTranslation: TranslationProvider & { calls: string[] } = {
  name: "mock-translation",
  calls: [],
  async translate(text, from, to) {
    this.calls.push(`${from}->${to}`);
    return `[${to}] ${text}`;
  },
};

async function* emptyAudio(): AsyncIterable<AudioChunk> {}

async function collect(pipeline: VoiceAgentPipeline): Promise<PipelineEvent[]> {
  const events: PipelineEvent[] = [];
  for await (const event of pipeline.run(emptyAudio())) {
    events.push(event);
  }
  return events;
}

describe("VoiceAgentPipeline", () => {
  it("exécute un tour complet : STT final → LLM streaming → phrases → TTS audio", async () => {
    const pipeline = new VoiceAgentPipeline(
      {
        stt: makeStt([{ text: "Bonjour, vos horaires ?", isFinal: true }]),
        llm: makeLlm(["Nous sommes ", "ouverts de 8h à 19h. ", "À bientôt !"]),
        tts: makeTts(),
      },
      { systemPrompt: "Tu es un agent." }
    );

    const events = await collect(pipeline);
    const types = events.map((e) => e.type);

    expect(types).toContain("user-transcript");
    expect(types).toContain("agent-text");
    expect(types).toContain("agent-sentence");
    expect(types).toContain("agent-audio");
    expect(types).toContain("turn-complete");
    expect(types).not.toContain("error");

    const complete = events.find((e) => e.type === "turn-complete");
    expect(complete && "agentText" in complete && complete.agentText).toContain(
      "ouverts de 8h à 19h"
    );

    // L'historique contient system + user + assistant.
    const history = pipeline.getHistory();
    expect(history.map((m) => m.role)).toEqual(["system", "user", "assistant"]);
  });

  it("streaming réel : l'audio de la 1re phrase sort avant la fin de la génération LLM", async () => {
    const pipeline = new VoiceAgentPipeline(
      {
        stt: makeStt([{ text: "Question", isFinal: true }]),
        llm: makeLlm(["Première phrase. ", "Seconde ", "phrase."], {
          delayMs: 20,
        }),
        tts: makeTts(),
      },
      { systemPrompt: "Agent." }
    );

    const events = await collect(pipeline);
    const firstAudioIdx = events.findIndex((e) => e.type === "agent-audio");
    const lastTextIdx = events
      .map((e, i) => (e.type === "agent-text" ? i : -1))
      .reduce((a, b) => Math.max(a, b), -1);
    expect(firstAudioIdx).toBeGreaterThan(-1);
    expect(firstAudioIdx).toBeLessThan(lastTextIdx);
  });

  it("traduit dans les deux sens quand speakLanguage != thinkLanguage", async () => {
    echoTranslation.calls = [];
    const pipeline = new VoiceAgentPipeline(
      {
        stt: makeStt([{ text: "Ŋdi na mi", isFinal: true, language: "ee" }]),
        llm: makeLlm(["Réponse complète."]),
        tts: makeTts(),
        translation: echoTranslation,
      },
      { systemPrompt: "Agent.", speakLanguage: "ee", thinkLanguage: "fr" }
    );

    const events = await collect(pipeline);
    expect(echoTranslation.calls).toContain("ee->fr"); // énoncé utilisateur
    expect(echoTranslation.calls).toContain("fr->ee"); // phrases de l'agent

    const sentence = events.find((e) => e.type === "agent-sentence");
    expect(sentence && "text" in sentence && sentence.text).toContain("[ee]");
  });

  it("barge-in : l'utilisateur interrompt la réponse de l'agent", async () => {
    const pipeline = new VoiceAgentPipeline(
      {
        stt: makeStt([
          { text: "Première question", isFinal: true },
          80, // le LLM lent est en train de répondre
          { text: "Attendez", isFinal: false }, // l'utilisateur reprend la parole
          { text: "Autre question", isFinal: true },
        ]),
        llm: makeLlm(
          Array.from({ length: 20 }, (_, i) => `delta${i} phrase. `),
          { delayMs: 25 }
        ),
        tts: makeTts(),
      },
      { systemPrompt: "Agent." }
    );

    const events = await collect(pipeline);
    const types = events.map((e) => e.type);
    expect(types).toContain("interrupted");
    // Le second tour aboutit malgré l'interruption du premier.
    expect(types.filter((t) => t === "turn-complete").length).toBeGreaterThanOrEqual(1);
  });

  it("erreur LLM : événement error non fatal, le tour suivant fonctionne", async () => {
    let call = 0;
    const flakyLlm: LLMProvider = {
      name: "flaky",
      async *complete() {
        call++;
        if (call === 1) throw new ProviderError("llm", "flaky", "panne");
        yield "Réponse OK.";
      },
    };

    const pipeline = new VoiceAgentPipeline(
      {
        stt: makeStt([
          { text: "Question 1", isFinal: true },
          { text: "Question 2", isFinal: true },
        ]),
        llm: flakyLlm,
        tts: makeTts(),
      },
      { systemPrompt: "Agent." }
    );

    const events = await collect(pipeline);
    const errors = events.filter((e) => e.type === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].type === "error" && errors[0].stage).toBe("llm");
    expect(errors[0].type === "error" && errors[0].fatal).toBe(false);
    expect(events.some((e) => e.type === "turn-complete")).toBe(true);
  });

  it("erreur TTS : dégradation en texte (les phrases restent émises)", async () => {
    const pipeline = new VoiceAgentPipeline(
      {
        stt: makeStt([{ text: "Question", isFinal: true }]),
        llm: makeLlm(["Réponse importante."]),
        tts: makeTts({ fail: true }),
      },
      { systemPrompt: "Agent." }
    );

    const events = await collect(pipeline);
    const types = events.map((e) => e.type);
    expect(types).toContain("agent-sentence");
    expect(types).not.toContain("agent-audio");
    const errors = events.filter((e) => e.type === "error");
    expect(errors.some((e) => e.type === "error" && e.stage === "tts")).toBe(true);
    expect(types).toContain("turn-complete");
  });

  it("erreur STT : fatale, le flux se termine", async () => {
    const brokenStt: SpeechToTextProvider = {
      name: "broken",
      async *transcribeStream() {
        throw new ProviderError("stt", "broken", "endpoint injoignable");
      },
    };
    const pipeline = new VoiceAgentPipeline(
      { stt: brokenStt, llm: makeLlm(["x"]), tts: makeTts() },
      { systemPrompt: "Agent." }
    );

    const events = await collect(pipeline);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    expect(events[0].type === "error" && events[0].fatal).toBe(true);
  });

  it("runTextTurn : tour texte (widget) avec traduction", async () => {
    echoTranslation.calls = [];
    const pipeline = new VoiceAgentPipeline(
      {
        stt: { name: "unused", transcribeStream: async function* () {} },
        llm: makeLlm(["Réponse texte."]),
        translation: echoTranslation,
      },
      { systemPrompt: "Agent.", speakLanguage: "ee", thinkLanguage: "fr" }
    );

    const reply = await pipeline.runTextTurn("Ŋdi");
    expect(reply).toContain("[ee]");
    expect(pipeline.getHistory()).toHaveLength(3);
  });
});
