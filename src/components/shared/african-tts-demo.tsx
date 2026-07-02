"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DEFAULT_TEXT =
  "Ŋdi na mi. Nye nye AfrivoxAI ƒe gbe ƒe kpɔɖeŋu. Míele dɔ wɔm be míaƒe agentwo nate ŋu ado go le Eʋegbe me.";

type TtsResponse = {
  ok: boolean;
  language: string;
  provider: string;
  model: string;
  license: string;
  commercialUse: boolean;
  text: string;
  audioMimeType: string;
  audioBase64: string;
  metadata?: { sampling_rate?: number; bytes?: number };
};

export function AfricanTtsDemo() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [result, setResult] = useState<TtsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const audioSrc = useMemo(() => {
    if (!result?.audioBase64) return null;
    return `data:${result.audioMimeType};base64,${result.audioBase64}`;
  }, [result]);

  async function generateDemo() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/tts/ewe/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Impossible de générer la voix Éwé");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Démo voix Éwé</CardTitle>
              <CardDescription>
                Génère un court audio en langue locale pour démonstration investisseurs.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>Éwé / Togo</Badge>
            <Badge variant="secondary">Meta MMS-TTS</Badge>
            <Badge variant="outline">Prototype non commercial</Badge>
          </div>

          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={450}
            className="min-h-32"
            placeholder="Saisir un texte court en Éwé..."
          />
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{text.length}/450 caractères</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setText(DEFAULT_TEXT)}
              disabled={isLoading}
            >
              Remettre le texte démo
            </Button>
          </div>

          <Button onClick={generateDemo} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Générer la voix Éwé
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Génération impossible</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Résultat audio
          </CardTitle>
          <CardDescription>
            Le fichier est généré côté serveur en WAV PCM 16 kHz mono.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {audioSrc ? (
            <>
              <audio controls src={audioSrc} className="w-full" />
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p><strong>Langue :</strong> {result?.language}</p>
                <p><strong>Modèle :</strong> {result?.model}</p>
                <p><strong>Licence :</strong> {result?.license}</p>
                <p><strong>Usage commercial :</strong> non, démo/R&D seulement</p>
                {result?.metadata?.sampling_rate && (
                  <p><strong>Échantillonnage :</strong> {result.metadata.sampling_rate} Hz</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
              Lance la génération pour écouter la voix Éwé directement ici.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
