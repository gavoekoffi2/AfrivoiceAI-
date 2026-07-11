import crypto from "crypto";

/**
 * Cache mémoire des audios TTS générés pour les réponses `<Play>` des
 * callbacks Africa's Talking.
 *
 * ⚠️ Limite documentée : cache PAR INSTANCE Node (déploiement Docker
 * mono-instance actuel). En multi-instances, déplacer vers un storage partagé
 * (S3/Supabase Storage) — l'interface reste la même.
 */

interface CachedAudio {
  data: Uint8Array;
  contentType: string;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 min : le temps d'un appel.
const store = new Map<string, CachedAudio>();

export function putAudio(data: Uint8Array, contentType = "audio/wav"): string {
  prune();
  const id = crypto.randomUUID();
  store.set(id, { data, contentType, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function getAudio(id: string): CachedAudio | null {
  prune();
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(id);
    return null;
  }
  return entry;
}

function prune(): void {
  const now = Date.now();
  const keys = Array.from(store.keys());
  for (const key of keys) {
    const entry = store.get(key);
    if (entry && now >= entry.expiresAt) store.delete(key);
  }
}
