/**
 * Logger structuré minimal. Compatible Edge/Node, sans dépendance.
 * En prod : sortie JSON pour les agrégateurs (Logflare, Datadog, etc.).
 * En dev : sortie lisible.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: Level = (process.env.LOG_LEVEL as Level) ?? "info";
const isProd = process.env.NODE_ENV === "production";

function emit(level: Level, scope: string, message: string, data?: unknown) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  if (isProd) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      scope,
      message,
      ...(data && typeof data === "object" ? { data } : {}),
    };
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
    return;
  }

  const prefix = `[${level.toUpperCase()}] [${scope}]`;
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](prefix, message, data ?? "");
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, data?: unknown) => emit("debug", scope, msg, data),
    info: (msg: string, data?: unknown) => emit("info", scope, msg, data),
    warn: (msg: string, data?: unknown) => emit("warn", scope, msg, data),
    error: (msg: string, data?: unknown) => emit("error", scope, msg, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;
