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
 * Sous prefers-reduced-motion : on conserve un fondu d'opacité (sans
 * translation) — accessible, mais le contenu reste vivant à l'apparition.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  duration = 0.6,
}: RevealProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: reduce ? 0.5 : duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
