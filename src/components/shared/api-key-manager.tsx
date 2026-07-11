"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ActionResult = { success?: string; error?: string; apiKey?: string };

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
}

/** Gestion des clés API : création (affichage unique) + révocation. */
export function ApiKeyManager({
  keys,
  createAction,
  revokeAction,
}: {
  keys: ApiKeyRow[];
  createAction: (formData: FormData) => Promise<ActionResult>;
  revokeAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        action={(fd) => startTransition(async () => setResult(await createAction(fd)))}
      >
        <Input name="name" placeholder="Nom de la clé (ex. Backend production)" />
        <Button type="submit" disabled={pending}>
          Créer une clé API
        </Button>
      </form>

      {result?.apiKey && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">
            Copiez cette clé maintenant — elle ne sera plus jamais affichée :
          </p>
          <code className="mt-1 block break-all rounded bg-white p-2 text-xs">
            {result.apiKey}
          </code>
        </div>
      )}
      {result?.error && <p className="text-sm text-destructive">{result.error}</p>}

      <ul className="space-y-2">
        {keys.map((key) => (
          <li
            key={key.id}
            className="flex items-center justify-between rounded-md border p-3 text-sm"
          >
            <div>
              <span className="font-medium">{key.name}</span>{" "}
              <code className="text-xs text-muted-foreground">{key.prefix}…</code>
            </div>
            {key.revokedAt ? (
              <Badge variant="outline">Révoquée</Badge>
            ) : (
              <form
                action={(fd) =>
                  startTransition(async () => setResult(await revokeAction(fd)))
                }
              >
                <input type="hidden" name="keyId" value={key.id} />
                <Button type="submit" variant="outline" size="sm" disabled={pending}>
                  Révoquer
                </Button>
              </form>
            )}
          </li>
        ))}
        {keys.length === 0 && (
          <li className="text-sm text-muted-foreground">Aucune clé API.</li>
        )}
      </ul>
    </div>
  );
}
