import { describe, expect, it } from "vitest";
import { getVoiceDemoStatus } from "./demo-state";

describe("getVoiceDemoStatus", () => {
  it("présente un état prêt avant la connexion", () => {
    expect(getVoiceDemoStatus("disconnected", false)).toEqual({
      label: "Prête pour la démonstration",
      detail: "Appuyez sur le bouton et autorisez le microphone.",
      tone: "idle",
    });
  });

  it("indique clairement que la connexion est en cours", () => {
    expect(getVoiceDemoStatus("connecting", false).tone).toBe("connecting");
  });

  it("distingue l'écoute de la réponse de l'agent", () => {
    expect(getVoiceDemoStatus("connected", false).label).toBe("Je vous écoute");
    expect(getVoiceDemoStatus("connected", true).label).toBe("AfrivoxAI vous répond");
  });
});
