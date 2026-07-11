import {
  ChatMessage,
  LLMProvider,
  LlmOptions,
  ProviderError,
} from "../types";

/**
 * Provider LLM Claude (API Anthropic Messages, streaming SSE).
 *
 * Modèles configurables par variables d'environnement (contrainte n°3) :
 * - `LLM_MODEL_SIMPLE`   (défaut `claude-haiku-4-5`)   : agents simples (FAQ, RDV)
 * - `LLM_MODEL_DEFAULT`  (défaut `claude-sonnet-4-6`)  : conversations standard
 * - `LLM_MODEL_PREMIUM`  (défaut `claude-opus-4-8`)    : raisonnement complexe
 *
 * Chaque agent peut surcharger le modèle via `agents.model` (tier ou id complet).
 */

export type ModelTier = "simple" | "default" | "premium";

export function resolveClaudeModel(tierOrModel?: string | null): string {
  const simple = process.env.LLM_MODEL_SIMPLE ?? "claude-haiku-4-5";
  const def = process.env.LLM_MODEL_DEFAULT ?? "claude-sonnet-4-6";
  const premium = process.env.LLM_MODEL_PREMIUM ?? "claude-opus-4-8";

  switch (tierOrModel) {
    case null:
    case undefined:
    case "":
    case "default":
      return def;
    case "simple":
      return simple;
    case "premium":
      return premium;
    default:
      // Id de modèle complet fourni directement (ex. claude-fable-5).
      return tierOrModel;
  }
}

const ANTHROPIC_VERSION = "2023-06-01";

export class ClaudeLLMProvider implements LLMProvider {
  readonly name = "claude";

  constructor(
    private readonly config: {
      apiKey?: string;
      baseUrl?: string;
      defaultModel?: string;
    } = {}
  ) {}

  private getApiKey(): string {
    const key = this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new ProviderError(
        "llm",
        this.name,
        "ANTHROPIC_API_KEY non configuré"
      );
    }
    return key;
  }

  async *complete(
    messages: ChatMessage[],
    opts: LlmOptions = {}
  ): AsyncIterable<string> {
    const baseUrl =
      this.config.baseUrl ??
      process.env.ANTHROPIC_BASE_URL ??
      "https://api.anthropic.com";
    const model = resolveClaudeModel(
      opts.model ?? this.config.defaultModel ?? "default"
    );

    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const chat = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.getApiKey(),
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: opts.maxTokens ?? 400,
          temperature: opts.temperature ?? 0.7,
          ...(system ? { system } : {}),
          messages: chat,
          stream: true,
        }),
        signal: opts.signal,
      });
    } catch (error) {
      throw new ProviderError(
        "llm",
        this.name,
        "requête Anthropic impossible",
        error
      );
    }

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      throw new ProviderError(
        "llm",
        this.name,
        `HTTP ${response.status} — ${detail.slice(0, 300)}`
      );
    }

    // Parse du flux SSE : événements `content_block_delta` → deltas de texte.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let event: {
            type?: string;
            delta?: { type?: string; text?: string };
            error?: { message?: string };
          };
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }
          if (event.type === "error") {
            throw new ProviderError(
              "llm",
              this.name,
              event.error?.message ?? "erreur de streaming Anthropic"
            );
          }
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            event.delta.text
          ) {
            yield event.delta.text;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
