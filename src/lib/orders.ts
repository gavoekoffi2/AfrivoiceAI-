export type OrderOutcome = "confirmed" | "cancelled" | "no_answer";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const NO_ANSWER_REASONS = [
  /did-not-answer/,
  /no-answer/,
  /customer-busy/,
  /voicemail/,
  /machine-detected/,
  /unreachable/,
];

const NO_ANSWER_PATTERNS = [
  /\bpas de reponse\b/,
  /\bn'?a pas repondu\b/,
  /\bmessagerie\b/,
  /\bvoicemail\b/,
  /\brepondeur\b/,
  /\bno[- ]answer\b/,
  /\binjoignable\b/,
];

const CANCEL_PATTERNS = [
  /\bannul\w*/,
  /\brefus\w*/,
  /\bpas interess\w*/,
  /\bn'?est pas interess\w*/,
  /\bne veut (pas|plus)\b/,
  /\bne souhaite (pas|plus)\b/,
  /\bne confirme pas\b/,
  /\bcommande (est )?annulee?\b/,
  /\bcancel\w*/,
];

const CONFIRM_PATTERNS = [
  /\bconfirm\w*/,
  /\bd'?accord\b/,
  /\bc'?est bon\b/,
  /\bvalide\w*/,
  /\baccepte\w*/,
  /\bsera disponible\b/,
  /\bdisponible pour la livraison\b/,
  /\battend la livraison\b/,
];

/**
 * Détermine l'issue d'une commande COD à partir du rapport de fin d'appel.
 *
 * Priorité : raison de fin technique (non décroché) > annulation explicite >
 * confirmation. En cas de doute avec une vraie conversation, on confirme
 * (comportement historique), sinon on classe en "sans réponse" pour
 * permettre une relance.
 */
export function analyzeOrderOutcome(params: {
  summary?: string | null;
  transcript?: string | null;
  endedReason?: string | null;
}): OrderOutcome {
  const endedReason = normalize(params.endedReason ?? "");
  if (matchesAny(endedReason, NO_ANSWER_REASONS)) return "no_answer";

  const combined = normalize(
    `${params.summary ?? ""} ${params.transcript ?? ""}`
  ).trim();

  if (!combined) return "no_answer";

  if (matchesAny(combined, NO_ANSWER_PATTERNS)) return "no_answer";
  if (matchesAny(combined, CANCEL_PATTERNS)) return "cancelled";
  if (matchesAny(combined, CONFIRM_PATTERNS)) return "confirmed";

  // L'appel a eu lieu et rien n'indique un refus
  return "confirmed";
}

/**
 * Traduit la raison de fin Vapi en statut final d'appel pour notre base.
 */
export function mapEndedReasonToCallStatus(
  endedReason?: string | null
): "completed" | "failed" | "no-answer" {
  const reason = normalize(endedReason ?? "");
  if (matchesAny(reason, NO_ANSWER_REASONS)) return "no-answer";
  if (/error|failed|invalid|rejected/.test(reason)) return "failed";
  return "completed";
}
