/**
 * Arrière-plan ambiant : halos lumineux (or + violet + fuchsia) très diffus,
 * en dérive lente, + quadrillage. Purement décoratif et `aria-hidden`.
 * Les animations `animate-drift` sont neutralisées sous prefers-reduced-motion.
 */
export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute -top-40 left-1/4 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-amber-500/25 blur-[100px] animate-drift" />
      <div
        className="absolute top-1/4 right-0 h-[36rem] w-[36rem] translate-x-1/3 rounded-full bg-violet-600/25 blur-[100px] animate-drift"
        style={{ animationDelay: "-8s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[32rem] w-[32rem] rounded-full bg-fuchsia-500/15 blur-[100px] animate-drift"
        style={{ animationDelay: "-16s" }}
      />
    </div>
  );
}
