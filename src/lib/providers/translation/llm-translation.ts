import {
  LLMProvider,
  NotDeployedError,
  TranslationProvider,
} from "../types";

const LANGUAGE_NAMES: Record<string, string> = {
  fr: "français",
  en: "anglais",
  ee: "éwé",
  ewe: "éwé",
  yo: "yoruba",
  yor: "yoruba",
  ha: "haoussa",
  hau: "haoussa",
};

function langLabel(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code;
}

/**
 * Traduction par LLM (Claude par défaut).
 *
 * Choix documenté (DATASETS.md) : il n'existe pas de modèle de traduction
 * open + gratuit + commercial fiable pour les langues africaines visées
 * (NLLB-200, MMS-MT et MAFAND-MT sont CC-BY-NC). La voie commerciale est la
 * traduction par LLM. Le modèle est configurable via
 * `TRANSLATION_MODEL` (défaut : tier "simple" = Haiku, le moins cher).
 */
export class LlmTranslationProvider implements TranslationProvider {
  readonly name = "llm-translation";

  constructor(private readonly llm: LLMProvider) {}

  async translate(
    text: string,
    from: string,
    to: string,
    opts: { signal?: AbortSignal } = {}
  ): Promise<string> {
    if (!text.trim()) return "";
    if (from.toLowerCase() === to.toLowerCase()) return text;

    const model = process.env.TRANSLATION_MODEL ?? "simple";
    let out = "";
    for await (const delta of this.llm.complete(
      [
        {
          role: "system",
          content:
            `Tu es un traducteur professionnel ${langLabel(from)} → ${langLabel(to)}. ` +
            `Traduis fidèlement le texte fourni, sans rien ajouter ni commenter. ` +
            `Registre oral naturel adapté à un appel téléphonique. ` +
            `Réponds UNIQUEMENT avec la traduction.`,
        },
        { role: "user", content: text },
      ],
      { model, maxTokens: 500, temperature: 0.2, signal: opts.signal }
    )) {
      out += delta;
    }
    return out.trim();
  }
}

/**
 * STUB NLLB — VOLONTAIREMENT NON DÉPLOYÉ.
 *
 * Meta NLLB-200 est sous licence CC-BY-NC-4.0 (non commercial). Conformément
 * à la contrainte n°2 (uniquement des ressources à licence commerciale
 * confirmée), ce provider n'est PAS activable en production. Il n'existe que
 * pour matérialiser l'emplacement d'un futur modèle de traduction open à
 * licence commerciale, si un jour il en existe un pour ces langues.
 */
export class NllbTranslationStub implements TranslationProvider {
  readonly name = "nllb-stub";

  async translate(): Promise<string> {
    throw new NotDeployedError(
      "translation",
      this.name,
      "NLLB-200 est CC-BY-NC (non commercial) : interdit en production. Utiliser LlmTranslationProvider."
    );
  }
}
