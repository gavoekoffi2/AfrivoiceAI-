import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveOpenRouterModel } from "./openrouter";

describe("resolveOpenRouterModel (tiers configurables)", () => {
  const keys = [
    "OPENROUTER_MODEL_SIMPLE",
    "OPENROUTER_MODEL_DEFAULT",
    "OPENROUTER_MODEL_PREMIUM",
  ] as const;
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of keys) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  });

  it("mappe les tiers vers les défauts Anthropic d'OpenRouter", () => {
    expect(resolveOpenRouterModel("simple")).toBe("anthropic/claude-haiku-4.5");
    expect(resolveOpenRouterModel("default")).toBe("anthropic/claude-sonnet-4.5");
    expect(resolveOpenRouterModel("premium")).toBe("anthropic/claude-opus-4.1");
    expect(resolveOpenRouterModel(undefined)).toBe("anthropic/claude-sonnet-4.5");
    expect(resolveOpenRouterModel("")).toBe("anthropic/claude-sonnet-4.5");
  });

  it("respecte les surcharges d'environnement", () => {
    process.env.OPENROUTER_MODEL_SIMPLE = "meta-llama/llama-3.3-70b-instruct";
    expect(resolveOpenRouterModel("simple")).toBe(
      "meta-llama/llama-3.3-70b-instruct"
    );
  });

  it("laisse passer un id de modèle OpenRouter complet", () => {
    expect(resolveOpenRouterModel("google/gemini-2.5-flash")).toBe(
      "google/gemini-2.5-flash"
    );
  });
});
