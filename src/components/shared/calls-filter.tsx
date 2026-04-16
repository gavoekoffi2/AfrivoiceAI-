"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CallsFilterProps {
  currentType?: string;
  currentStatus?: string;
}

const TYPE_OPTIONS = [
  { value: "", label: "Tous les types" },
  { value: "ecommerce_confirmation", label: "E-commerce" },
  { value: "prospecting", label: "Prospection" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "completed", label: "Terminé" },
  { value: "failed", label: "Échoué" },
  { value: "no-answer", label: "Sans réponse" },
  { value: "in-progress", label: "En cours" },
  { value: "queued", label: "En file" },
];

export function CallsFilter({ currentType, currentStatus }: CallsFilterProps) {
  const router = useRouter();
  const pathname = usePathname();

  function applyFilter(type: string | undefined, status: string | undefined) {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="space-y-3">
      {/* Filtre par type */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Type</p>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={
                (currentType ?? "") === opt.value ? "default" : "outline"
              }
              size="sm"
              onClick={() =>
                applyFilter(opt.value || undefined, currentStatus)
              }
              className="h-7 text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filtre par statut */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Statut
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={
                (currentStatus ?? "") === opt.value ? "default" : "outline"
              }
              size="sm"
              onClick={() =>
                applyFilter(currentType, opt.value || undefined)
              }
              className="h-7 text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
