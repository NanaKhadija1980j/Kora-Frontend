/**
 * Structured API Logger for Kora Protocol.
 * Outputs logs as JSON to console.log for ingestion/monitoring.
 */

export interface LogContext {
  requestId?: string | null;
  route?: string | null;
  [key: string]: any;
}

/**
 * Recursively redacts sensitive fields and serializes Error objects.
 */
export function redact(obj: any): any {
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
    };
  }

  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redact);
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("key") ||
      lowerKey.includes("authorization") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("signature") ||
      lowerKey.includes("passphrase") ||
      lowerKey.includes("mnemonic") ||
      lowerKey.includes("seed")
    ) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redact(obj[key]);
    }
  }
  return result;
}

class StructuredLogger {
  private log(level: "info" | "warn" | "error", message: string, context: LogContext = {}) {
    const { requestId, route, ...extra } = context;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: requestId || null,
      route: route || null,
      ...redact(extra),
    };

    console.log(JSON.stringify(logEntry));
  }

  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext) {
    this.log("error", message, context);
  }
}

export const logger = new StructuredLogger();
