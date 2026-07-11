import {
  ChatMessage,
  LLMProvider,
  LlmOptions,
  ProviderError,
} from "../types";

/**
 * Provider LLM OpenRouter (https://openrouter.ai) — API OpenAI-compatible
 * donnant accès à de nombreux modèles (Claude, Gemini, Llama, Mistral…)
 * avec une seule clé.
 *
 * Configuration :
 * - `OPENROUTER_API_KEY`      : clé sk-or-v1-… (JAMAIS commitée — .env.local)
 * - `OPENROUTER_MODEL_SIMPLE` / `OPENROUTER_MODEL_DEFAULT` /
 *   `OPENROUTER_MODEL_PREMIUM` : ids de modèles OpenRouter par tier
 *   (format `fournisseur/modele`, ex. `anthropic/claude-haiku-4.5`).
 *
 * Le champ `model` d'un agent accepte un tier ("simple" | "default" |
 * "premium") ou un id OpenRouter complet (contenant un `/`).
 */

export function resolveOpenRouterModel(tierOrModel?: string | null): string {
  const simple =
    process.env.OPENROUTER_MODEL_SIMPLE ?? "anthropic/claude-haiku-4.5";
  const def =
    process.env.OPENROUTER_MODEL_DEFAULT ?? "anthropic/claude-sonnet-4.5";
  const premium =
    process.env.OPENROUTER_MODEL_PREMIUM ?? "anthropic/claude-opus-4.1";

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
      // Id complet OpenRouter (contient un slash) ou id direct.
      return tierOrModel;
  }
}

export class OpenRouterLLMProvider implements LLMProvider {
  readonly name = "openrouter";

  constructor(
    private readonly config: {
      apiKey?: string;
      baseUrl?: string;
      defaultModel?: string;
    } = {}
  ) {}

  private getApiKey(): string {
    const key = this.config.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new ProviderError(
        "llm",
        this.name,
        "OPENROUTER_API_KEY non configuré (à mettre dans .env.local, jamais dans le dépôt)"
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
      process.env.OPENROUTER_BASE_URL ??
      "https://openrouter.ai/api";
    const model = resolveOpenRouterModel(
      opts.model ?? this.config.defaultModel ?? "default"
    );

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getApiKey()}`,
          // Attribution facultative recommandée par OpenRouter.
          ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
          "X-Title": "AfrivoiceAI",
        },
        body: JSON.stringify({
          model,
          messages, // rôle "system" supporté nativement (format OpenAI)
          max_tokens: opts.maxTokens ?? 400,
          temperature: opts.temperature ?? 0.7,
          stream: true,
        }),
        signal: opts.signal,
      });
    } catch (error) {
      throw new ProviderError(
        "llm",
        this.name,
        "requête OpenRouter impossible",
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

    // Flux SSE OpenAI-compatible : choices[0].delta.content.
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
            choices?: Array<{ delta?: { content?: string } }>;
            error?: { message?: string };
          };
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }
          if (event.error) {
            throw new ProviderError(
              "llm",
              this.name,
              event.error.message ?? "erreur de streaming OpenRouter"
            );
          }
          const delta = event.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
