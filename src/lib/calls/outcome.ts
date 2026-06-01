export type OrderOutcome = "confirmed" | "cancelled" | "no_answer";

const ORDER_OUTCOMES: readonly OrderOutcome[] = [
  "confirmed",
  "cancelled",
  "no_answer",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Détecte un mot/expression en respectant les frontières de mots (FR/EN). */
export function mentions(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => {
    if (/\s/.test(kw)) return text.includes(kw);
    const re = new RegExp(
      `(^|[^a-zàâäéèêëîïôöùûüç])${escapeRegExp(kw)}([^a-zàâäéèêëîïôöùûüç]|$)`,
      "i"
    );
    return re.test(text);
  });
}

/**
 * Lit l'issue déterministe extraite par Vapi (structuredDataPlan) si présente
 * et valide. Renvoie null si absente/invalide pour laisser l'heuristique
 * prendre le relais.
 */
export function parseStructuredOutcome(
  structuredData: unknown
): OrderOutcome | null {
  if (!structuredData || typeof structuredData !== "object") return null;
  const raw = (structuredData as Record<string, unknown>).outcome;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (ORDER_OUTCOMES as readonly string[]).includes(normalized)
    ? (normalized as OrderOutcome)
    : null;
}

/**
 * Heuristique de repli : déduit l'issue d'une commande à partir du résumé IA
 * (signal principal, plus fiable que le transcript brut qui contient le script
 * de l'assistant).
 *
 * Choix produit : en cas d'ambiguïté on NE confirme PAS automatiquement —
 * confirmer à tort une commande COD entraîne une livraison non désirée et une
 * perte financière. Le défaut sûr est "no_answer" (revue manuelle / relance).
 */
export function analyzeCallOutcome(
  summary: string,
  transcript: string
): OrderOutcome {
  const primary = (summary || "").toLowerCase();
  const full = `${summary || ""} ${transcript || ""}`.toLowerCase();

  const noAnswerKw = [
    "pas de réponse",
    "n'a pas répondu",
    "ne répond pas",
    "messagerie",
    "répondeur",
    "voicemail",
    "injoignable",
    "occupé",
    "no answer",
    "no-answer",
    "did not answer",
  ];
  const cancelKw = [
    "annul",
    "annulé",
    "annulée",
    "ne confirme pas",
    "pas intéressé",
    "n'est pas intéressé",
    "refuse",
    "refusé",
    "ne veut pas",
    "ne souhaite pas",
    "mauvais numéro",
    "cancel",
    "cancelled",
    "not interested",
    "declined",
  ];
  const confirmKw = [
    "confirme",
    "confirmé",
    "confirmée",
    "a confirmé",
    "accepte",
    "accepté",
    "validé",
    "valide la commande",
    "d'accord pour",
    "sera disponible",
    "confirm",
    "confirmed",
    "accepted",
    "agreed",
  ];

  if (mentions(full, noAnswerKw)) return "no_answer";
  if (mentions(primary, cancelKw)) return "cancelled";
  if (mentions(primary, confirmKw)) return "confirmed";
  if (mentions(full, cancelKw)) return "cancelled";
  if (mentions(full, confirmKw)) return "confirmed";

  return "no_answer";
}

/**
 * Issue finale d'une commande : la donnée structurée déterministe prime,
 * sinon repli sur l'heuristique.
 */
export function resolveOrderOutcome(params: {
  structuredData?: unknown;
  summary?: string | null;
  transcript?: string | null;
}): OrderOutcome {
  return (
    parseStructuredOutcome(params.structuredData) ??
    analyzeCallOutcome(params.summary ?? "", params.transcript ?? "")
  );
}

/** Qualification d'un lead (structured data déterministe puis heuristique). */
export function resolveLeadQualified(params: {
  structuredData?: unknown;
  summary?: string | null;
}): boolean {
  const sd = params.structuredData;
  if (sd && typeof sd === "object") {
    const raw = (sd as Record<string, unknown>).qualified;
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "string") {
      return ["true", "oui", "yes", "qualified", "qualifié"].includes(
        raw.trim().toLowerCase()
      );
    }
  }
  const s = (params.summary ?? "").toLowerCase();
  return mentions(s, ["intéressé", "qualifié", "interested", "qualified"]);
}
