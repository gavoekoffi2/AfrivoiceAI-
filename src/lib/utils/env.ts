/**
 * Helpers de validation d'environnement.
 * Évite les bugs silencieux quand une variable critique est absente.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`[env] Variable d'environnement requise manquante : ${name}`);
  }
  return value;
}

export function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim().length === 0) return fallback;
  return value;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production";
}
