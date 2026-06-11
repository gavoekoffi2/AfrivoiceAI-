"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Carte avec inclinaison 3D qui suit le curseur (effet de profondeur).
 */
export function TiltCard({
  children,
  className,
  maxTilt = 8,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number>(0);

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1000px) rotateX(${-py * maxTilt}deg) rotateY(${px * maxTilt}deg)`;
    });
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.transform =
      "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn("tilt-3d", className)}
    >
      {children}
    </div>
  );
}
