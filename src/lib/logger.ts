/**
 * Logger structuré minimaliste — sortie JSON parsable par les outils de
 * centralisation (Datadog, Axiom, etc.). En dev, utilise console.* pour la
 * lisibilité.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV !== "production";

function write(level: LogLevel, scope: string, message: string, context?: LogContext) {
  const payload = {
    level,
    scope,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (isDev) {
    const tag = `[${scope}]`;
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    fn(tag, message, context ?? "");
    return;
  }

  const fn = level === "error" ? console.error : console.log;
  fn(JSON.stringify(payload));
}

export const logger = {
  debug: (scope: string, message: string, context?: LogContext) =>
    write("debug", scope, message, context),
  info: (scope: string, message: string, context?: LogContext) =>
    write("info", scope, message, context),
  warn: (scope: string, message: string, context?: LogContext) =>
    write("warn", scope, message, context),
  error: (scope: string, message: string, context?: LogContext) =>
    write("error", scope, message, context),
};
