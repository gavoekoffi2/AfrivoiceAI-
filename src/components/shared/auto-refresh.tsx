"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraîchit les données serveur tant que des appels sont en cours, pour que
 * les statuts (sonnerie → en cours → terminé) évoluent sans recharger la page.
 * Le polling s'arrête quand l'onglet est masqué.
 */
export function AutoRefresh({
  enabled,
  intervalMs = 5000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
