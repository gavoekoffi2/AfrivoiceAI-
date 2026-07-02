import { describe, expect, it } from "vitest";
import { extractVapiCallArtifacts } from "./artifacts";

describe("extractVapiCallArtifacts", () => {
  it("keeps top-level Vapi end-of-call fields", () => {
    const result = extractVapiCallArtifacts({
      recordingUrl: "https://cdn.example.com/call.mp3",
      transcript: "Assistant: Bonjour\nClient: Oui",
      summary: "Le client accepte un rappel.",
    });

    expect(result.recordingUrl).toBe("https://cdn.example.com/call.mp3");
    expect(result.transcript).toContain("Assistant: Bonjour");
    expect(result.summary).toBe("Le client accepte un rappel.");
    expect(result.messages).toBeNull();
  });

  it("extracts nested artifact recording and structured agent/client messages", () => {
    const result = extractVapiCallArtifacts({
      analysis: { summary: "Le client demande une démo." },
      artifact: {
        recordingUrl: "https://cdn.example.com/nested.wav",
        messages: [
          { role: "system", message: "Instruction interne à ne jamais afficher." },
          { role: "assistant", message: "Bonjour, ici AfrivoxAI." },
          { role: "user", message: "Je veux comprendre le prix." },
          { role: "assistant", content: "Je peux vous expliquer." },
        ],
      },
    });

    expect(result.recordingUrl).toBe("https://cdn.example.com/nested.wav");
    expect(result.summary).toBe("Le client demande une démo.");
    expect(result.messages).toEqual([
      {
        speaker: "assistant",
        role: "assistant",
        text: "Bonjour, ici AfrivoxAI.",
        timestamp: undefined,
        secondsFromStart: undefined,
      },
      {
        speaker: "client",
        role: "user",
        text: "Je veux comprendre le prix.",
        timestamp: undefined,
        secondsFromStart: undefined,
      },
      {
        speaker: "assistant",
        role: "assistant",
        text: "Je peux vous expliquer.",
        timestamp: undefined,
        secondsFromStart: undefined,
      },
    ]);
    expect(result.transcript).toBe(
      "Assistant: Bonjour, ici AfrivoxAI.\nClient: Je veux comprendre le prix.\nAssistant: Je peux vous expliquer."
    );
  });
});
