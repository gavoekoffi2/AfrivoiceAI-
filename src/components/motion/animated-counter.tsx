"use client";

import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { useEffect, useRef } from "react";

interface AnimatedCounterProps {
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  format?: (v: number) => string;
  className?: string;
}

/**
 * Compteur qui s'incrémente quand il entre dans le viewport.
 */
export function AnimatedCounter({
  to,
  duration = 1.6,
  suffix = "",
  prefix = "",
  format,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) =>
    format ? format(v) : Math.round(v).toLocaleString("fr-FR")
  );

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionVal, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    return controls.stop;
  }, [isInView, motionVal, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}
