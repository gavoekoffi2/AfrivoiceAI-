import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt, validateAgentInput } from "./agents";

describe("validateAgentInput", () => {
  const valid = {
    name: "Awa",
    systemPrompt: "Tu es une assistante chaleureuse et efficace.",
  };

  it("accepte une entrée valide", () => {
    expect(validateAgentInput(valid)).toBeNull();
    expect(validateAgentInput({ ...valid, model: "premium" })).toBeNull();
    expect(validateAgentInput({ ...valid, model: "claude-haiku-4-5" })).toBeNull();
  });

  it("rejette un nom ou des instructions trop courts", () => {
    expect(validateAgentInput({ ...valid, name: "A" })).toMatch(/nom/i);
    expect(
      validateAgentInput({ ...valid, systemPrompt: "court" })
    ).toMatch(/instructions/i);
  });

  it("rejette un modèle ou statut inconnu", () => {
    expect(validateAgentInput({ ...valid, model: "gpt-4" })).toMatch(/modèle/i);
    expect(validateAgentInput({ ...valid, status: "pause" })).toMatch(/statut/i);
  });
});

describe("buildAgentSystemPrompt", () => {
  const agent = {
    name: "Awa",
    systemPrompt: "Tu renseignes sur l'état civil.",
    callScenario: "1. Saluer\n2. Identifier le besoin",
  };

  it("assemble personnalité + scénario + connaissances", () => {
    const prompt = buildAgentSystemPrompt(agent, [
      { title: "Horaires", content: "Ouvert 8h-17h du lundi au vendredi." },
    ]);
    expect(prompt).toContain("Awa");
    expect(prompt).toContain("état civil");
    expect(prompt).toContain("Scénario d'appel");
    expect(prompt).toContain("### Horaires");
    expect(prompt).toContain("8h-17h");
  });

  it("tronque la base de connaissances au budget de caractères", () => {
    const huge = "x".repeat(50_000);
    const prompt = buildAgentSystemPrompt(agent, [
      { title: "Doc1", content: huge },
      { title: "Doc2", content: huge },
    ]);
    // Budget 12 000 caractères de connaissances (+ structure).
    expect(prompt.length).toBeLessThan(15_000);
  });

  it("fonctionne sans scénario ni connaissances", () => {
    const prompt = buildAgentSystemPrompt(
      { name: "Awa", systemPrompt: "Prompt de base.", callScenario: null },
      []
    );
    expect(prompt).toContain("Prompt de base.");
    expect(prompt).not.toContain("Scénario");
    expect(prompt).not.toContain("Base de connaissances");
  });
});
