"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Compteur qui s'anime de 0 jusqu'à la valeur cible à l'entrée dans le viewport.
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  durationMs = 1400,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame: number;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const animate = (now: number) => {
          const progress = Math.min((now - start) / durationMs, 1);
          // easeOutExpo pour un finish doux
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setDisplay(Math.round(eased * value));
          if (progress < 1) frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("fr-FR")}
      {suffix}
    </span>
  );
}
