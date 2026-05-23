import pRetry, { AbortError, type Options } from "p-retry";

/**
 * Wrapper autour de p-retry avec config par défaut sensée
 * pour les appels Vapi / DB / HTTP externes.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Partial<Options> = {}
): Promise<T> {
  return pRetry(fn, {
    retries: 3,
    factor: 2,
    minTimeout: 500,
    maxTimeout: 5000,
    randomize: true,
    ...options,
  });
}

export { AbortError };
