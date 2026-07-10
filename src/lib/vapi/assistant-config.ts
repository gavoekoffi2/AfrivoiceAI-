import type { Vapi } from "@vapi-ai/server-sdk";

/**
 * Configuration LLM de l'assistant Vapi, pilotée par variables d'environnement
 * (corrige le modèle codé en dur `gemini-1.5-flash`).
 *
 * Par défaut on conserve le comportement existant (Google Gemini Flash) pour ne
 * rien casser. La refonte de la Partie B introduira la couche `LLMProvider`
 * avec Claude (Haiku/Sonnet par défaut, Fable/Opus en option). En attendant,
 * ces variables permettent déjà de changer de modèle sans redéploiement de code.
 */
export function buildVapiModel(
  systemPrompt: string,
  maxTokens: number
): Vapi.CreateAssistantDtoModel {
  const provider = (process.env.VAPI_LLM_PROVIDER ??
    "google") as Vapi.CreateAssistantDtoModel["provider"];
  const model = process.env.VAPI_LLM_MODEL ?? "gemini-1.5-flash";
  const temperature = Number(process.env.VAPI_LLM_TEMPERATURE ?? "0.7");

  return {
    provider,
    model,
    messages: [{ role: "system", content: systemPrompt }],
    tools: [{ type: "endCall" }],
    maxTokens,
    temperature: Number.isFinite(temperature) ? temperature : 0.7,
  } as Vapi.CreateAssistantDtoModel;
}

/**
 * Durée maximale d'un appel (seconde). Garde-fou financier : empêche qu'un
 * appel anormalement long ne fasse passer le wallet en négatif. Configurable
 * via `CALL_MAX_DURATION_SECONDS` (défaut : 300 s = 5 min).
 */
export function getMaxCallDurationSeconds(): number {
  const raw = Number(process.env.CALL_MAX_DURATION_SECONDS ?? "300");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 300;
}
