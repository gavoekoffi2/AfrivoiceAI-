import crypto from "crypto";

/**
 * Déclenchement d'appels internes (webhook → API) via un token DÉDIÉ.
 *
 * Sécurité : on n'utilise plus `SUPABASE_SERVICE_ROLE_KEY` comme secret de
 * header. Cette clé donne un accès god-mode à la base ; la transmettre entre
 * services est un risque majeur. À la place, un token interne dédié
 * (`INTERNAL_JOB_TOKEN`), sans autre privilège que de déclencher un job.
 */

const INTERNAL_HEADER = "x-internal-job-token";

function getConfiguredToken(): string | undefined {
  const token = process.env.INTERNAL_JOB_TOKEN?.trim();
  return token && token.length >= 16 ? token : undefined;
}

/** Vérifie qu'une requête entrante porte le token interne valide (fail-closed). */
export function isInternalJobRequest(req: Request): boolean {
  const configured = getConfiguredToken();
  if (!configured) return false; // Non configuré ⇒ on refuse.

  const provided = req.headers.get(INTERNAL_HEADER)?.trim() ?? "";
  if (provided.length !== configured.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(configured)
    );
  } catch {
    return false;
  }
}

/** Déclenche l'appel de confirmation e-commerce via l'API interne. */
export async function triggerInternalCall(body: {
  orderId: string;
}): Promise<void> {
  const configured = getConfiguredToken();
  if (!configured) {
    throw new Error(
      "INTERNAL_JOB_TOKEN non configuré : déclenchement d'appel interne désactivé."
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const response = await fetch(new URL("/api/calls/initiate", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [INTERNAL_HEADER]: configured,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Déclenchement d'appel interne refusé (HTTP ${response.status}).`
    );
  }
}
