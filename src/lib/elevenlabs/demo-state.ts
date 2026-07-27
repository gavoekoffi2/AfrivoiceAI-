export type VoiceDemoConnectionStatus = "disconnected" | "connecting" | "connected";

export type VoiceDemoStatus = {
  label: string;
  detail: string;
  tone: "idle" | "connecting" | "listening" | "speaking";
};

export function getVoiceDemoStatus(
  status: VoiceDemoConnectionStatus,
  isSpeaking: boolean
): VoiceDemoStatus {
  if (status === "connecting") {
    return {
      label: "Connexion sécurisée en cours",
      detail: "AfrivoxAI prépare la conversation vocale.",
      tone: "connecting",
    };
  }

  if (status === "connected") {
    return isSpeaking
      ? {
          label: "AfrivoxAI vous répond",
          detail: "Vous pouvez l’interrompre naturellement à tout moment.",
          tone: "speaking",
        }
      : {
          label: "Je vous écoute",
          detail: "Parlez normalement, comme pendant un appel téléphonique.",
          tone: "listening",
        };
  }

  return {
    label: "Prête pour la démonstration",
    detail: "Appuyez sur le bouton et autorisez le microphone.",
    tone: "idle",
  };
}
