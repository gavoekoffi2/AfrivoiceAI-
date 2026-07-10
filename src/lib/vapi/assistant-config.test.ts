import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildVapiModel, getMaxCallDurationSeconds } from "./assistant-config";

describe("buildVapiModel (modèle LLM configurable)", () => {
  const keys = [
    "VAPI_LLM_PROVIDER",
    "VAPI_LLM_MODEL",
    "VAPI_LLM_TEMPERATURE",
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

  it("garde le défaut Gemini Flash quand rien n'est configuré", () => {
    const model = buildVapiModel("PROMPT", 250) as unknown as Record<string, unknown>;
    expect(model.provider).toBe("google");
    expect(model.model).toBe("gemini-1.5-flash");
    expect(model.maxTokens).toBe(250);
    expect(model.messages).toEqual([{ role: "system", content: "PROMPT" }]);
  });

  it("respecte la configuration d'environnement", () => {
    process.env.VAPI_LLM_PROVIDER = "anthropic";
    process.env.VAPI_LLM_MODEL = "claude-sonnet-4-6";
    process.env.VAPI_LLM_TEMPERATURE = "0.4";
    const model = buildVapiModel("P", 300) as unknown as Record<string, unknown>;
    expect(model.provider).toBe("anthropic");
    expect(model.model).toBe("claude-sonnet-4-6");
    expect(model.temperature).toBe(0.4);
  });
});

describe("getMaxCallDurationSeconds (garde-fou financier)", () => {
  const original = process.env.CALL_MAX_DURATION_SECONDS;
  afterEach(() => {
    if (original === undefined) delete process.env.CALL_MAX_DURATION_SECONDS;
    else process.env.CALL_MAX_DURATION_SECONDS = original;
  });

  it("défaut 300 s", () => {
    delete process.env.CALL_MAX_DURATION_SECONDS;
    expect(getMaxCallDurationSeconds()).toBe(300);
  });

  it("respecte une valeur valide", () => {
    process.env.CALL_MAX_DURATION_SECONDS = "120";
    expect(getMaxCallDurationSeconds()).toBe(120);
  });

  it("retombe sur 300 pour une valeur invalide ou négative", () => {
    process.env.CALL_MAX_DURATION_SECONDS = "abc";
    expect(getMaxCallDurationSeconds()).toBe(300);
    process.env.CALL_MAX_DURATION_SECONDS = "-5";
    expect(getMaxCallDurationSeconds()).toBe(300);
  });
});
