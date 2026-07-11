/**
 * Rate limiting par plan (API publique + widget).
 *
 * Implémentation : token bucket en mémoire de processus.
 *
 * ⚠️ Limite documentée : ce limiteur est PAR INSTANCE Node. En déploiement
 * multi-instances (plusieurs replicas Docker), les quotas sont multipliés par
 * le nombre d'instances — remplacer le store par Redis (même interface) avant
 * de scaler horizontalement. Suffisant et honnête pour le déploiement Docker
 * mono-instance actuel.
 */

export interface RateLimitRule {
  /** Requêtes autorisées par fenêtre. */
  limit: number;
  /** Fenêtre en millisecondes. */
  windowMs: number;
}

/** Quotas par plan d'organisation. */
export const PLAN_LIMITS: Record<string, RateLimitRule> = {
  free: { limit: 30, windowMs: 60_000 },
  pro: { limit: 120, windowMs: 60_000 },
  enterprise: { limit: 600, windowMs: 60_000 },
};

export function ruleForPlan(plan: string | null | undefined): RateLimitRule {
  return PLAN_LIMITS[plan ?? "free"] ?? PLAN_LIMITS.free;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms de réinitialisation de la fenêtre. */
  resetAt: number;
}

/**
 * Consomme une requête pour la clé donnée (clé API, clé publique, IP…).
 * Fenêtre fixe — simple, prévisible, sans dépendance.
 */
export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now()
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= rule.limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: rule.limit - bucket.count,
    resetAt: bucket.resetAt,
  };
}

/** Nettoyage périodique (évite la croissance mémoire sur longues durées). */
export function pruneExpiredBuckets(now: number = Date.now()): void {
  const entries = Array.from(buckets.entries());
  for (const [key, bucket] of entries) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/** Réservé aux tests. */
export function _resetRateLimiter(): void {
  buckets.clear();
}
