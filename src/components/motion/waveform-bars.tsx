"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Barres audio animées en boucle — illustration d'une voix qui parle.
 */
export function WaveformBars({
  className,
  bars = 20,
  colorClass = "bg-primary",
}: {
  className?: string;
  bars?: number;
  colorClass?: string;
}) {
  return (
    <div
      className={cn("flex h-10 items-center justify-center gap-[3px]", className)}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className={cn("w-[3px] rounded-full", colorClass)}
          animate={{
            height: ["20%", "100%", "40%", "80%", "30%", "70%", "20%"],
          }}
          transition={{
            duration: 1.4 + (i % 5) * 0.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.05,
          }}
        />
      ))}
    </div>
  );
}
