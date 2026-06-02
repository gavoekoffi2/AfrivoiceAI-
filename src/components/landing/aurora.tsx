/**
 * Arrière-plan ambiant : halos lumineux (or + violet) très diffus + quadrillage.
 * Purement décoratif et `aria-hidden`. Les animations sont neutralisées par la
 * règle globale `prefers-reduced-motion`.
 */
export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-grid" />
      <div className="absolute -top-32 left-1/4 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl animate-aurora" />
      <div
        className="absolute top-1/3 right-0 h-[30rem] w-[30rem] translate-x-1/3 rounded-full bg-violet-600/20 blur-3xl animate-aurora"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-amber-400/10 blur-3xl animate-aurora"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}
