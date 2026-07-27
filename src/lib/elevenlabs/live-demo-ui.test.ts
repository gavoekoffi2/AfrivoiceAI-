import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentPath = "src/components/shared/afrivox-live-demo.tsx";
const pagePath = "src/app/demo-vocale/page.tsx";

describe("démonstration vocale publique AfrivoxAI", () => {
  it("propose une vraie session micro interruptible et une transcription", () => {
    const source = readFileSync(componentPath, "utf8");
    expect(source).toContain("ConversationProvider");
    expect(source).toContain("navigator.mediaDevices.getUserMedia");
    expect(source).toContain("Démarrer la conversation");
    expect(source).toContain("Terminer la conversation");
    expect(source).toContain("Transcription en direct");
    expect(source).toContain("Vous pouvez l’interrompre");
  });

  it("expose une page de démonstration sans numéro téléphonique", () => {
    const source = readFileSync(pagePath, "utf8");
    expect(source).toContain("Aucun numéro téléphonique requis");
    expect(source).toContain("AfrivoxLiveDemo");
  });
});
