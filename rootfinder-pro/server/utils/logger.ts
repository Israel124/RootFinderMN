type LogLevel = "info" | "warn" | "error" | "debug";

/**
 * Emite logs estructurados en JSON para facilitar auditoría y observabilidad.
 */
function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

/**
 * Logger principal del backend.
 */
export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    writeLog("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    writeLog("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    writeLog("error", message, context);
  },
  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      writeLog("debug", message, context);
    }
  },
};

