"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Bande défilante en CSS pur (plus performant que JS pour les marquees).
 * Le contenu est dupliqué pour assurer une boucle invisible.
 */
export function Marquee({
  children,
  className,
  durationSec = 30,
  reverse = false,
  pauseOnHover = true,
}: {
  children: ReactNode;
  className?: string;
  durationSec?: number;
  reverse?: boolean;
  pauseOnHover?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex overflow-hidden [--gap:2rem] [gap:var(--gap)]",
        className
      )}
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1}
          className={cn(
            "flex shrink-0 items-center justify-around gap-[var(--gap)] [animation:marquee_var(--duration)_linear_infinite]",
            reverse && "[animation-direction:reverse]",
            pauseOnHover && "group-hover:[animation-play-state:paused]"
          )}
          style={{
            // @ts-expect-error CSS variable
            "--duration": `${durationSec}s`,
          }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
