import { NextResponse } from "next/server";
import { ApiKeyContext, resolveApiKey } from "./api-keys";
import { consumeRateLimit, ruleForPlan } from "./rate-limit";

/**
 * Garde d'entrée de l'API publique `/api/v1/*` :
 * 1. authentification par clé API (Bearer) ;
 * 2. rate limiting selon le plan de l'organisation.
 *
 * Retourne soit le contexte authentifié, soit une réponse d'erreur prête.
 */
export async function guardPublicApi(
  req: Request
): Promise<{ ctx: ApiKeyContext } | { response: NextResponse }> {
  const ctx = await resolveApiKey(req);
  if (!ctx) {
    return {
      response: NextResponse.json(
        {
          error: "unauthorized",
          message:
            "Clé API manquante ou invalide. Fournir `Authorization: Bearer avk_live_...`.",
        },
        { status: 401 }
      ),
    };
  }

  const rule = ruleForPlan(ctx.plan);
  const result = consumeRateLimit(`api:${ctx.apiKeyId}`, rule);
  const headers = {
    "X-RateLimit-Limit": String(rule.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    return {
      response: NextResponse.json(
        {
          error: "rate_limited",
          message: `Quota du plan « ${ctx.plan} » dépassé. Réessayer après la fenêtre en cours.`,
        },
        { status: 429, headers }
      ),
    };
  }

  return { ctx };
}
