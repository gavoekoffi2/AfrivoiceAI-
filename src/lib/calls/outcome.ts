export type OrderCallOutcome =
  | "confirmed"
  | "cancelled"
  | "no_answer"
  | "uncertain";

/** Découpe un texte en mots (minuscules, sans ponctuation) pour un matching
 *  par mot entier — évite les faux positifs de sous-chaîne (« non » dans
 *  « téléphone », « ok » dans « stock », etc.). */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // retire les accents
      .split(/[^a-z0-9']+/)
      .filter(Boolean)
  );
}

/** Vrai si un token commence par la racine donnée (gère les variantes
 *  morphologiques : confirm → confirme/confirmee/confirmer/confirmation). */
function tokenStartsWith(tokens: Set<string>, stem: string): boolean {
  for (const token of tokens) {
    if (token.startsWith(stem)) return true;
  }
  return false;
}

function hasAny(tokens: Set<string>, stems: string[]): boolean {
  return stems.some((stem) => {
    const parts = stem.split(" ");
    if (parts.length === 1) return tokenStartsWith(tokens, parts[0]);
    // Expression multi-mots : chaque mot doit être présent (par racine).
    return parts.every((p) => tokenStartsWith(tokens, p));
  });
}

/**
 * Détermine l'issue d'un appel de confirmation de commande à partir du résumé
 * et de la transcription.
 *
 * Changement de sécurité métier : **plus de « confirmed » par défaut**.
 * Sans signal clair, on retourne `"uncertain"` — l'appelant NE DOIT PAS
 * confirmer automatiquement une commande (risque de livraison/facturation à
 * tort). L'ancien comportement confirmait toute commande sans mot-clé négatif.
 */
export function analyzeOrderCallOutcome(
  summary: string | null | undefined,
  transcript: string | null | undefined
): OrderCallOutcome {
  const tokens = tokenize(`${summary ?? ""} ${transcript ?? ""}`);
  if (tokens.size === 0) return "uncertain";

  // Racines (préfixes) pour tolérer les variantes accentuées/conjuguées.
  const noAnswer = [
    "messagerie",
    "voicemail",
    "occup", // occupé, occupée
    "injoignable",
    "repondeur", // répondeur
    "no answer",
  ];
  const cancel = [
    "annul", // annule, annulée, annuler, annulation
    "refus", // refuse, refuser, refusé
    "pas interesse", // pas intéressé
    "plus interesse",
  ];
  const confirm = [
    "confirm", // confirme, confirmée, confirmer, confirmation
    "accord", // d'accord
    "parfait",
    "disponible",
  ];

  // Ordre de priorité : no_answer > cancel > confirm.
  if (hasAny(tokens, noAnswer)) return "no_answer";
  if (hasAny(tokens, cancel)) return "cancelled";
  if (hasAny(tokens, confirm)) return "confirmed";

  return "uncertain";
}
