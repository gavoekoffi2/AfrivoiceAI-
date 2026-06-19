export type NormalizedCallMessage = {
  speaker: "assistant" | "client" | "system" | "unknown";
  text: string;
  role?: string;
  timestamp?: string;
  secondsFromStart?: number;
};

export type ExtractedVapiCallArtifacts = {
  recordingUrl: string | null;
  transcript: string | null;
  summary: string | null;
  messages: NormalizedCallMessage[] | null;
  rawArtifact: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getPath(root: unknown, path: string[]): unknown {
  let current = root;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function firstNonEmptyString(root: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const value = getPath(root, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toSpeaker(value: unknown): NormalizedCallMessage["speaker"] {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (["assistant", "ai", "bot", "agent", "amina"].some((token) => raw.includes(token))) {
    return "assistant";
  }
  if (["user", "human", "customer", "client", "caller", "callee"].some((token) => raw.includes(token))) {
    return "client";
  }
  if (raw.includes("system")) return "system";
  return "unknown";
}

function normalizeMessage(value: unknown): NormalizedCallMessage | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? { speaker: "unknown", text: trimmed } : null;
  }

  if (!isRecord(value)) return null;

  const text =
    firstNonEmptyString(value, [
      ["message"],
      ["content"],
      ["text"],
      ["transcript"],
      ["utterance"],
    ]) ?? null;

  if (!text) return null;

  const role = firstNonEmptyString(value, [["role"], ["speaker"], ["type"], ["participant"]]) ?? undefined;
  const timestamp = firstNonEmptyString(value, [["timestamp"], ["time"], ["startedAt"], ["startTime"]]) ?? undefined;
  const rawSeconds = getPath(value, ["secondsFromStart"]) ?? getPath(value, ["start"]);
  const secondsFromStart = typeof rawSeconds === "number" ? rawSeconds : undefined;

  return {
    speaker: toSpeaker(role),
    text,
    role,
    timestamp,
    secondsFromStart,
  };
}

function findMessages(root: unknown): NormalizedCallMessage[] | null {
  const candidates = [
    getPath(root, ["messages"]),
    getPath(root, ["conversation"]),
    getPath(root, ["artifact", "messages"]),
    getPath(root, ["artifact", "conversation"]),
    getPath(root, ["artifact", "transcript", "messages"]),
    getPath(root, ["call", "messages"]),
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const normalized = candidate
      .map(normalizeMessage)
      .filter((message): message is NormalizedCallMessage =>
        Boolean(message && message.speaker !== "system")
      );
    if (normalized.length > 0) return normalized;
  }

  return null;
}

function transcriptFromMessages(messages: NormalizedCallMessage[] | null): string | null {
  if (!messages?.length) return null;
  return messages
    .map((message) => {
      const label =
        message.speaker === "assistant"
          ? "Assistant"
          : message.speaker === "client"
          ? "Client"
          : message.speaker === "system"
          ? "Système"
          : "Intervenant";
      return `${label}: ${message.text}`;
    })
    .join("\n");
}

export function extractVapiCallArtifacts(message: unknown): ExtractedVapiCallArtifacts {
  const messages = findMessages(message);
  const transcript =
    firstNonEmptyString(message, [
      ["transcript"],
      ["artifact", "transcript"],
      ["artifact", "transcriptText"],
      ["analysis", "transcript"],
    ]) ?? transcriptFromMessages(messages);

  const recordingUrl = firstNonEmptyString(message, [
    ["recordingUrl"],
    ["recording_url"],
    ["stereoRecordingUrl"],
    ["artifact", "recordingUrl"],
    ["artifact", "recording_url"],
    ["artifact", "stereoRecordingUrl"],
    ["artifact", "recording", "url"],
  ]);

  const summary = firstNonEmptyString(message, [
    ["summary"],
    ["analysis", "summary"],
    ["artifact", "summary"],
    ["artifact", "analysis", "summary"],
  ]);

  const artifact = getPath(message, ["artifact"]);
  const rawArtifact = isRecord(artifact) ? artifact : null;

  return {
    recordingUrl,
    transcript,
    summary,
    messages,
    rawArtifact,
  };
}
