"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Délai d'entrée (s) — pratique pour créer un effet d'escalier. */
  delay?: number;
  /** Décalage vertical initial (px). */
  y?: number;
  /** Durée (s). */
  duration?: number;
}

/**
 * Révèle son contenu à l'entrée dans le viewport (une seule fois).
 * Respecte `prefers-reduced-motion` (aucun mouvement si demandé).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  duration = 0.6,
}: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
