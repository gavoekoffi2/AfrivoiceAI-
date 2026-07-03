import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { calls, orders, leads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PhoneCall,
  ArrowLeft,
  Clock,
  DollarSign,
  FileText,
  Volume2,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Info,
  MessageSquare,
} from "lucide-react";
import {
  formatFcfa,
  formatDuration,
  getCallStatusLabel,
  getOrderStatusLabel,
} from "@/lib/utils";
import { AudioPlayer } from "@/components/shared/audio-player";

export const dynamic = "force-dynamic";

const callStatusColors: Record<string, "success" | "destructive" | "warning" | "secondary" | "info"> = {
  completed: "success",
  failed: "destructive",
  "no-answer": "warning",
  queued: "secondary",
  "in-progress": "info",
  ringing: "info",
};

export default async function CallDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const callResult = await db
    .select()
    .from(calls)
    .where(
      and(
        eq(calls.id, params.id),
        eq(calls.organizationId, session.organizationId)
      )
    )
    .limit(1);

  if (!callResult[0]) notFound();

  const call = callResult[0];

  // Récupérer les données associées (commande ou lead)
  const [orderResult, leadResult] = await Promise.all([
    call.orderId
      ? db
          .select()
          .from(orders)
          .where(eq(orders.id, call.orderId))
          .limit(1)
      : Promise.resolve([]),
    call.leadId
      ? db.select().from(leads).where(eq(leads.id, call.leadId)).limit(1)
      : Promise.resolve([]),
  ]);

  const order = (orderResult as typeof orders.$inferSelect[])[0];
  const lead = (leadResult as typeof leads.$inferSelect[])[0];

  const costFcfa = call.costFcfa ? parseFloat(call.costFcfa) : 0;
  const costUsd = call.costUsd ? parseFloat(call.costUsd) : 0;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={call.type === "ecommerce_confirmation" ? "/e-commerce" : "/campaigns"}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {call.type === "ecommerce_confirmation" ? "Commandes" : "Campagnes"}
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-sm">Appel #{call.id.slice(0, 8)}</span>
      </div>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {call.type === "ecommerce_confirmation"
                ? "Confirmation de commande"
                : "Appel de prospection"}
            </h2>
            <Badge variant={callStatusColors[call.status] ?? "secondary"}>
              {getCallStatusLabel(call.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {new Date(call.createdAt).toLocaleDateString("fr-TG", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-4 lg:col-span-2">
          {/* Lecteur audio */}
          {call.recordingUrl && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Volume2 className="h-5 w-5 text-primary" />
                  Enregistrement de l&apos;appel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AudioPlayer src={call.recordingUrl} />
              </CardContent>
            </Card>
          )}

          {/* Résumé IA */}
          {call.summary && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-5 w-5 text-primary" />
                  Résumé de l&apos;appel (IA)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
                  {call.summary}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversation structurée */}
          {Array.isArray(call.callMessages) && call.callMessages.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Conversation agent/client
                </CardTitle>
                <CardDescription>
                  Tout ce qui s&apos;est dit pendant l&apos;appel, séparé par intervenant
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[32rem] overflow-y-auto rounded-md border bg-muted/20 p-4">
                  <StructuredMessagesViewer messages={call.callMessages} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transcription */}
          {call.transcript ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-primary" />
                  Transcription complète
                </CardTitle>
                <CardDescription>
                  Conversation retranscrite automatiquement par IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/20 p-4">
                  <TranscriptViewer transcript={call.transcript} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">
                  {call.status === "completed"
                    ? "Transcription non disponible"
                    : "L'appel n'est pas encore terminé"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — Métadonnées */}
        <div className="space-y-4">
          {/* Métriques */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Métriques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Durée
                </div>
                <span className="text-sm font-medium">
                  {call.durationSeconds
                    ? formatDuration(call.durationSeconds)
                    : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Coût facturé
                </div>
                <span className="text-sm font-medium">
                  {costFcfa > 0 ? formatFcfa(costFcfa) : "—"}
                </span>
              </div>
              {costUsd > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Coût API brut</span>
                  <span className="text-xs text-muted-foreground">
                    ${costUsd.toFixed(4)}
                  </span>
                </div>
              )}
              {call.endedReason && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Motif de fin</span>
                    <span className="text-sm font-medium capitalize">
                      {call.endedReason.replace(/-/g, " ")}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Commande associée */}
          {order && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Commande associée
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{order.customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{order.customerPhone}</span>
                </div>
                {order.customerAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm">{order.customerAddress}</span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Montant</span>
                  <span className="text-sm font-medium">
                    {order.totalAmount
                      ? formatFcfa(parseFloat(order.totalAmount))
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <Badge
                    variant={
                      order.status === "confirmed"
                        ? "success"
                        : order.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {getOrderStatusLabel(order.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Source</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {order.source}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lead associé */}
          {lead && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Lead associé
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lead.name && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{lead.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{lead.phone}</span>
                </div>
                {lead.company && (
                  <div className="text-sm text-muted-foreground">
                    Entreprise : {lead.company}
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Statut lead</span>
                  <Badge
                    variant={
                      lead.status === "qualified"
                        ? "success"
                        : lead.status === "not_interested"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {lead.status === "qualified"
                      ? "Qualifié"
                      : lead.status === "not_interested"
                      ? "Non intéressé"
                      : lead.status === "called"
                      ? "Appelé"
                      : "Nouveau"}
                  </Badge>
                </div>
                {lead.notes && (
                  <div className="rounded-md bg-muted/50 p-2 text-xs">
                    {lead.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ID Vapi */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">ID Vapi</p>
              <p className="text-xs font-mono break-all">{call.vapiCallId}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

type StructuredCallMessage = {
  speaker?: "assistant" | "client" | "system" | "unknown";
  text?: string;
  role?: string;
  timestamp?: string;
  secondsFromStart?: number;
};

function StructuredMessagesViewer({ messages }: { messages: StructuredCallMessage[] }) {
  return (
    <div className="space-y-3">
      {messages
        .filter(
          (message) =>
            message.speaker !== "system" &&
            typeof message.text === "string" &&
            message.text.trim()
        )
        .map((message, i) => {
          const isAssistant = message.speaker === "assistant";
          const isClient = message.speaker === "client";
          const label = isAssistant ? "IA" : isClient ? "Client" : "Info";
          const align = isAssistant ? "flex-row" : isClient ? "flex-row-reverse" : "flex-row";
          const bubbleClass = isAssistant
            ? "bg-primary/10 text-foreground"
            : isClient
            ? "bg-secondary text-secondary-foreground"
            : "bg-muted text-muted-foreground";

          return (
            <div key={i} className={`flex gap-3 ${align}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isAssistant
                    ? "bg-primary text-primary-foreground"
                    : isClient
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {label}
              </div>
              <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm ${bubbleClass}`}>
                {(message.timestamp || typeof message.secondsFromStart === "number") && (
                  <p className="mb-1 text-[10px] opacity-70">
                    {message.timestamp ?? `${Math.round(message.secondsFromStart ?? 0)}s`}
                  </p>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
              </div>
            </div>
          );
        })}
    </div>
  );
}

// Composant de formatage de la transcription
function TranscriptViewer({ transcript }: { transcript: string }) {
  // Essayer de parser une transcription structurée (format Vapi)
  const lines = transcript.split("\n").filter(Boolean);

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const isAssistant =
          line.toLowerCase().startsWith("ai:") ||
          line.toLowerCase().startsWith("assistant:") ||
          line.toLowerCase().startsWith("amina:");
        const isUser =
          line.toLowerCase().startsWith("user:") ||
          line.toLowerCase().startsWith("human:") ||
          line.toLowerCase().startsWith("client:");

        if (isAssistant || isUser) {
          const [speaker, ...rest] = line.split(":");
          const content = rest.join(":").trim();
          return (
            <div
              key={i}
              className={`flex gap-3 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isAssistant
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {isAssistant ? "IA" : "C"}
              </div>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isAssistant
                    ? "bg-primary/10 text-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {content}
              </div>
            </div>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}
