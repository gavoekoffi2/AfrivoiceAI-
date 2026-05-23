/**
 * Rate-limiter in-memory simple (par instance).
 * Pour scaler à plusieurs instances, remplacer par Upstash Redis.
 *
 * Convient pour : limiter login, signup, webhook bursts, deposit.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const MAX_KEYS = 10_000;

function gc() {
  if (buckets.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * @param key   Clé unique (ex. `login:<ip>` ou `webhook:<source>:<ip>`)
 * @param limit Nombre de requêtes autorisées par fenêtre
 * @param windowMs Durée de la fenêtre en ms
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
    gc();
  }

  bucket.count++;
  const remaining = Math.max(0, limit - bucket.count);

  return {
    success: bucket.count <= limit,
    remaining,
    resetAt: bucket.resetAt,
  };
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
