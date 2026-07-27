"use client";

import { useMemo, useState } from "react";
import {
  ConversationProvider,
  useConversation,
} from "@elevenlabs/react";
import {
  CircleStop,
  Headphones,
  Mic,
  MicOff,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getVoiceDemoStatus } from "@/lib/elevenlabs/demo-state";

type TranscriptEntry = {
  id: string;
  role: "user" | "agent";
  text: string;
};

function AfrivoxConversation() {
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const conversation = useConversation();

  function appendTranscript({
    role,
    message,
    event_id,
  }: {
    role: "user" | "agent";
    message: string;
    event_id?: number;
  }) {
    const text = message.trim();
    if (!text) return;
    setTranscript((current) => [
      ...current,
      {
        id: `${event_id ?? Date.now()}-${role}-${current.length}`,
        role,
        text,
      },
    ]);
  }

  const normalizedStatus =
    conversation.status === "connected"
      ? "connected"
      : conversation.status === "connecting"
        ? "connecting"
        : "disconnected";
  const status = useMemo(
    () => getVoiceDemoStatus(normalizedStatus, conversation.isSpeaking),
    [normalizedStatus, conversation.isSpeaking]
  );

  async function startConversation() {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Ce navigateur ne permet pas l’accès au microphone.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setTranscript([]);
      conversation.startSession({
        onConnect: () => setError(null),
        onError: (message) =>
          setError(message || "La connexion vocale a échoué."),
        onMessage: appendTranscript,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’accéder au microphone."
      );
    }
  }

  const connected = conversation.status === "connected";
  const busy = conversation.status === "connecting";

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-emerald-200/70 bg-slate-950 text-white shadow-xl dark:border-emerald-500/20">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950">
              <Headphones className="size-6" />
            </div>
            <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/10">
              Démo en temps réel
            </Badge>
          </div>
          <div>
            <CardTitle className="text-balance text-2xl text-white">
              Parlez directement avec AfrivoxAI
            </CardTitle>
            <p className="mt-2 text-pretty text-sm text-slate-300">
              Testez une vraie conversation de centre d’appels depuis votre navigateur. Vous pouvez l’interrompre naturellement pendant qu’elle parle.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "size-3 rounded-full",
                  status.tone === "speaking" && "bg-emerald-300",
                  status.tone === "listening" && "bg-sky-300",
                  status.tone === "connecting" && "bg-amber-300",
                  status.tone === "idle" && "bg-slate-400"
                )}
              />
              <div>
                <p className="font-semibold text-white">{status.label}</p>
                <p className="mt-1 text-sm text-slate-300">{status.detail}</p>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="border-red-400/40 bg-red-950/40 text-red-100">
              <AlertTitle>Connexion impossible</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!connected ? (
            <Button
              type="button"
              size="lg"
              className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={startConversation}
              disabled={busy}
            >
              <PhoneCall className="mr-2 size-5" />
              {busy ? "Connexion en cours…" : "Démarrer la conversation"}
            </Button>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => conversation.setMuted(!conversation.isMuted)}
              >
                {conversation.isMuted ? (
                  <Mic className="mr-2 size-5" />
                ) : (
                  <MicOff className="mr-2 size-5" />
                )}
                {conversation.isMuted ? "Réactiver le micro" : "Couper le micro"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={() => conversation.endSession()}
              >
                <CircleStop className="mr-2 size-5" />
                Terminer la conversation
              </Button>
            </div>
          )}

          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-emerald-300" />
              Micro du téléphone ou ordinateur
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-300" />
              Voix non enregistrée pour cette démo
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-lg dark:border-white/10">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-balance">
              <Volume2 className="size-5 text-emerald-600" />
              Transcription en direct
            </CardTitle>
            {connected && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300">
                Session active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {transcript.length > 0 ? (
            <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
              {transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-3 text-sm",
                    entry.role === "user"
                      ? "ml-auto bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                      : "border border-emerald-200 bg-emerald-50 text-slate-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-slate-100"
                  )}
                >
                  <p className="mb-1 text-xs font-semibold opacity-65">
                    {entry.role === "user" ? "Vous" : "AfrivoxAI"}
                  </p>
                  <p className="text-pretty">{entry.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Sparkles className="size-6" />
              </div>
              <p className="mt-4 font-semibold">La conversation apparaîtra ici</p>
              <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
                Demandez par exemple une simulation de service client, de prospection, de confirmation de commande ou de prise de rendez-vous.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AfrivoxLiveDemo() {
  const agentId =
    process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ??
    "agent_0501kyjxbn89fcyvs6q1923jedfs";

  if (!agentId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Agent vocal non configuré</AlertTitle>
        <AlertDescription>
          L’identifiant public de l’agent AfrivoxAI manque dans l’environnement.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ConversationProvider agentId={agentId}>
      <AfrivoxConversation />
    </ConversationProvider>
  );
}
