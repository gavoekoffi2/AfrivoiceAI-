import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  ChatMessage,
  LLMProvider,
  LlmOptions,
  ProviderError,
} from "../types";

/** Provider LLM Google Gemini (alternative à Claude, SDK officiel). */
export class GeminiLLMProvider implements LLMProvider {
  readonly name = "gemini";

  constructor(private readonly config: { apiKey?: string } = {}) {}

  async *complete(
    messages: ChatMessage[],
    opts: LlmOptions = {}
  ): AsyncIterable<string> {
    const apiKey = this.config.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ProviderError("llm", this.name, "GEMINI_API_KEY non configuré");
    }

    const model = opts.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
    const genAI = new GoogleGenerativeAI(apiKey);

    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const generativeModel = genAI.getGenerativeModel({
      model,
      ...(system ? { systemInstruction: system } : {}),
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 400,
        temperature: opts.temperature ?? 0.7,
      },
    });

    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));

    try {
      const result = await generativeModel.generateContentStream({ contents });
      for await (const chunk of result.stream) {
        if (opts.signal?.aborted) return;
        const text = chunk.text();
        if (text) yield text;
      }
    } catch (error) {
      throw new ProviderError(
        "llm",
        this.name,
        "échec de génération Gemini",
        error
      );
    }
  }
}
