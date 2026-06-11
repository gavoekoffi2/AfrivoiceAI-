"use client";

import { useEffect, useRef, useState } from "react";
import {
  PhoneCall,
  PhoneOutgoing,
  Mic,
  CheckCircle2,
  CalendarCheck,
  FileText,
  Sparkles,
} from "lucide-react";
import { TiltCard } from "./tilt-card";
import { cn } from "@/lib/utils";

type Phase = "idle" | "ringing" | "talking" | "result";

interface Bubble {
  speaker: "ai" | "prospect";
  text: string;
  /** pause après la bulle, en ms */
  hold: number;
}

const SCRIPT: Bubble[] = [
  {
    speaker: "ai",
    text: "Bonjour M. Mensah, ici Amina de Sankofa Digital. Je serai brève : nous aidons les PME de Lomé à trouver de nouveaux clients. Est-ce un sujet pour vous ?",
    hold: 900,
  },
  {
    speaker: "prospect",
    text: "Euh… oui, justement on cherche à développer notre clientèle.",
    hold: 700,
  },
  {
    speaker: "ai",
    text: "Parfait ! Je vous propose une démonstration de 15 minutes. Plutôt mardi à 10h ou mercredi à 15h ?",
    hold: 800,
  },
  { speaker: "prospect", text: "Mardi 10h, c'est très bien.", hold: 600 },
  {
    speaker: "ai",
    text: "C'est noté pour mardi 10h. Vous recevrez la confirmation par WhatsApp. Excellente journée !",
    hold: 1200,
  },
];

const TYPE_SPEED_MS = 26;

export function HeroCallDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [bubbles, setBubbles] = useState<{ speaker: "ai" | "prospect"; text: string }[]>([]);
  const [typingText, setTypingText] = useState("");
  const [typingSpeaker, setTypingSpeaker] = useState<"ai" | "prospect">("ai");
  const [seconds, setSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Auto-scroll de la conversation
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles, typingText]);

  // Chronomètre pendant l'appel
  useEffect(() => {
    if (phase !== "talking") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Machine à états de la démo (boucle infinie)
  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        timers.current.push(t);
      });

    async function typeBubble(bubble: Bubble) {
      setTypingSpeaker(bubble.speaker);
      setTypingText("");
      // petit temps de "réflexion"
      await wait(bubble.speaker === "ai" ? 500 : 800);
      for (let i = 1; i <= bubble.text.length; i++) {
        if (cancelled) return;
        setTypingText(bubble.text.slice(0, i));
        await wait(TYPE_SPEED_MS);
      }
      setBubbles((prev) => [
        ...prev,
        { speaker: bubble.speaker, text: bubble.text },
      ]);
      setTypingText("");
      await wait(bubble.hold);
    }

    async function run() {
      while (!cancelled) {
        setPhase("idle");
        setBubbles([]);
        setTypingText("");
        setSeconds(0);
        await wait(1200);
        if (cancelled) return;

        setPhase("ringing");
        await wait(2200);
        if (cancelled) return;

        setPhase("talking");
        for (const bubble of SCRIPT) {
          if (cancelled) return;
          await typeBubble(bubble);
        }

        setPhase("result");
        await wait(4500);
      }
    }

    run();
    return () => {
      cancelled = true;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <TiltCard className="relative mx-auto w-full max-w-[400px]">
      {/* Halo tournant derrière le téléphone */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[3rem] opacity-60 blur-2xl animate-spin-slow"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(139,92,246,0.45), rgba(245,158,11,0.35), rgba(16,185,129,0.3), rgba(139,92,246,0.45))",
        }}
      />

      <div className="animate-float rounded-[2rem] border border-white/10 bg-slate-900/90 p-4 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        {/* Barre d'état du "téléphone" */}
        <div className="tilt-depth flex items-center justify-between rounded-t-3xl px-2 pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-amber-500 text-white">
              {phase === "ringing" && (
                <span className="ring-pulse absolute inset-0 text-violet-400" />
              )}
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Amina · IA</p>
              <p className="text-[11px] text-slate-400">
                Campagne « PME Lomé Q3 »
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-500",
              phase === "ringing" &&
                "bg-amber-500/15 text-amber-300",
              phase === "talking" &&
                "bg-emerald-500/15 text-emerald-300",
              phase === "result" &&
                "bg-violet-500/15 text-violet-300",
              phase === "idle" && "bg-slate-700/40 text-slate-400"
            )}
          >
            {phase === "idle" && (
              <>
                <PhoneOutgoing className="h-3 w-3" />
                Numérotation…
              </>
            )}
            {phase === "ringing" && (
              <>
                <PhoneCall className="h-3 w-3 animate-pulse" />
                Sonnerie…
              </>
            )}
            {phase === "talking" && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                En ligne · {mm}:{ss}
              </>
            )}
            {phase === "result" && (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Terminé · {mm}:{ss}
              </>
            )}
          </div>
        </div>

        {/* Prospect appelé */}
        <div className="tilt-depth mb-3 flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-white">Kossi Mensah</p>
            <p className="text-[11px] text-slate-400">
              Directeur · SoluTech Lomé · +228 90 ·· ·· ··
            </p>
          </div>
          {/* Égaliseur vocal */}
          <div className="flex h-6 items-end gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "eq-bar w-[3px] rounded-full bg-gradient-to-t from-violet-500 to-amber-400",
                  phase !== "talking" && "!animation-none opacity-20"
                )}
                style={{
                  height: `${10 + (i % 3) * 6}px`,
                  animationDelay: `${i * 0.12}s`,
                  animationPlayState: phase === "talking" ? "running" : "paused",
                }}
              />
            ))}
          </div>
        </div>

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="tilt-depth h-[250px] space-y-2.5 overflow-hidden rounded-xl border border-white/5 bg-slate-950/60 p-3"
        >
          {phase === "result" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-white">
                Lead qualifié ✓
              </p>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                <p className="flex items-center justify-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5 text-violet-400" />
                  RDV confirmé : mardi 10h00
                </p>
                <p className="flex items-center justify-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-400" />
                  Transcription + résumé disponibles
                </p>
                <p className="flex items-center justify-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-emerald-400" />
                  Coût de l&apos;appel : 38 FCFA
                </p>
              </div>
            </div>
          ) : (
            <>
              {bubbles.map((bubble, i) => (
                <ChatBubble key={i} speaker={bubble.speaker}>
                  {bubble.text}
                </ChatBubble>
              ))}
              {typingText && (
                <ChatBubble speaker={typingSpeaker}>
                  {typingText}
                  <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-current align-middle" />
                </ChatBubble>
              )}
              {phase === "talking" && !typingText && bubbles.length === 0 && (
                <div className="flex items-center gap-1 px-2 py-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="typing-dot h-1.5 w-1.5 rounded-full bg-violet-400"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
              {(phase === "idle" || phase === "ringing") && (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-slate-500">
                    {phase === "idle"
                      ? "Préparation du script personnalisé…"
                      : "Appel de Kossi Mensah en cours…"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pied : pipeline temps réel */}
        <div className="tilt-depth mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Appelés", value: "127" },
            { label: "Qualifiés", value: "34" },
            { label: "RDV pris", value: "19" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-white/5 bg-white/5 py-2"
            >
              <p className="text-sm font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </TiltCard>
  );
}

function ChatBubble({
  speaker,
  children,
}: {
  speaker: "ai" | "prospect";
  children: React.ReactNode;
}) {
  const isAi = speaker === "ai";
  return (
    <div className={cn("flex", isAi ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-[11.5px] leading-relaxed",
          isAi
            ? "rounded-tl-sm bg-violet-500/15 text-violet-100"
            : "rounded-tr-sm bg-white/10 text-slate-200"
        )}
      >
        {children}
      </div>
    </div>
  );
}
