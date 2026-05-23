"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Erreur globale:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="text-muted-foreground max-w-md">
        Nous n&apos;avons pas pu charger cette page. Notre équipe a été
        notifiée. Réessayez ou retournez à l&apos;accueil.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Code : {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>Réessayer</Button>
        <Button asChild variant="outline">
          <Link href="/">Accueil</Link>
        </Button>
      </div>
    </div>
  );
}
