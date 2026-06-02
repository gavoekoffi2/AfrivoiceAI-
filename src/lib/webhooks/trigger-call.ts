import crypto from "crypto";

/**
 * Secret partagé entre les webhooks e-commerce et la route interne
 * `/api/calls/initiate`. On privilégie un secret dédié (`INTERNAL_API_SECRET`)
 * et on retombe sur la clé service Supabase pour rester rétro-compatible.
 */
export function getInternalApiSecret(): string {
  return (
    process.env.INTERNAL_API_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

/**
 * Vérifie le secret interne fourni par un appel serveur-à-serveur, en temps
 * constant. Renvoie false si aucun secret n'est configuré (fail-closed).
 */
export function verifyInternalSecret(provided: string | null): boolean {
  const expected = getInternalApiSecret();
  if (!expected || !provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  try {
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Déclenche (sans bloquer) l'appel de confirmation de commande via la route
 * interne. Les erreurs sont seulement journalisées : un échec de déclenchement
 * ne doit jamais faire échouer l'accusé de réception du webhook (sinon la
 * plateforme e-commerce rejouera indéfiniment la livraison).
 */
export function triggerConfirmationCall(orderId: string): void {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const secret = getInternalApiSecret();

  if (!secret) {
    console.error(
      "[webhooks] INTERNAL_API_SECRET / SUPABASE_SERVICE_ROLE_KEY manquant : appel non déclenché"
    );
    return;
  }

  void fetch(`${baseUrl}/api/calls/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify({ orderId }),
  }).catch((err) => {
    console.error(
      `[webhooks] Erreur déclenchement appel pour commande ${orderId}:`,
      err
    );
  });
}
