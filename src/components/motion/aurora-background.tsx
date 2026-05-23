"use client";

import { cn } from "@/lib/utils";

/**
 * Fond mesh-gradient animé pour les hero sections.
 * Utilise des blobs CSS qui bougent en boucle infinie.
 */
export function AuroraBackground({
  className,
  intensity = "default",
}: {
  className?: string;
  intensity?: "subtle" | "default" | "strong";
}) {
  const opacity =
    intensity === "subtle" ? 0.35 : intensity === "strong" ? 0.75 : 0.55;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <div
        className="absolute -top-32 -left-32 h-[40rem] w-[40rem] rounded-full bg-purple-500 blur-3xl [animation:aurora_18s_ease-in-out_infinite]"
        style={{ opacity }}
      />
      <div
        className="absolute top-0 right-[-10rem] h-[36rem] w-[36rem] rounded-full bg-fuchsia-500 blur-3xl [animation:aurora_22s_ease-in-out_infinite_reverse]"
        style={{ opacity: opacity * 0.9 }}
      />
      <div
        className="absolute bottom-[-12rem] left-1/3 h-[40rem] w-[40rem] rounded-full bg-indigo-500 blur-3xl [animation:aurora_26s_ease-in-out_infinite]"
        style={{ opacity: opacity * 0.85 }}
      />
      <div
        className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_0%,rgb(2_6_23/0.85)_75%)]"
      />
    </div>
  );
}
