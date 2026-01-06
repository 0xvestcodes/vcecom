import { trace } from "@opentelemetry/api";
import pino from "pino";
import { BUILD_INFO } from "../../build-info";

/**
 * Extract trace and span IDs from OpenTelemetry context
 * Returns undefined if tracing is not initialized or no active span exists
 */
function extractTraceContext(): { traceId?: string; spanId?: string } {
  try {
    const activeSpan = trace.getActiveSpan();
    if (!activeSpan) {
      return {};
    }

    const spanContext = activeSpan.spanContext();
    if (
      !spanContext.traceId ||
      spanContext.traceId === "00000000000000000000000000000000"
    ) {
      return {};
    }

    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };
  } catch (_error) {
    // Tracing not initialized or error accessing context
    return {};
  }
}

/**
 * Create a minimal Pino logger for use before NestJS bootstrap
 * Automatically includes OpenTelemetry trace/span IDs when available
 * Falls back to console if Pino initialization fails
 */
let earlyLoggerInstance: pino.Logger | null = null;

export function getEarlyLogger(): pino.Logger {
  if (earlyLoggerInstance) {
    return earlyLoggerInstance;
  }

  try {
    const isDevelopment = process.env.NODE_ENV === "development";
    const logLevel =
      process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info");
    const usePretty = process.env.LOG_PRETTY !== "false";

    const baseConfig: pino.LoggerOptions = {
      level: logLevel,
      base: {
        service: "vcecom-backend",
        version: BUILD_INFO.version || "0.0.1",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label };
        },
        // Automatically add trace/span IDs to all log entries
        log: (object) => {
          const traceContext = extractTraceContext();
          return {
            ...object,
            ...(traceContext.traceId && { traceId: traceContext.traceId }),
            ...(traceContext.spanId && { spanId: traceContext.spanId }),
          };
        },
      },
      redact: {
        paths: ["password", "token", "secret", "authorization", "cookie"],
        remove: false,
        censor: "[Redacted]",
      },
    };

    if (usePretty) {
      earlyLoggerInstance = pino(
        {
          ...baseConfig,
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
              singleLine: false,
              messageFormat: "{levelLabel} {msg}",
              errorLikeObjectKeys: ["err", "error"],
            },
          },
        },
        pino.destination(1), // stdout
      );
    } else {
      earlyLoggerInstance = pino(baseConfig, pino.destination(1));
    }

    return earlyLoggerInstance;
  } catch (error) {
    // Fallback to console if Pino fails (should never happen, but be safe)
    console.error(
      "[Early Logger] Failed to initialize Pino, using console fallback:",
      error,
    );
    // Return a minimal console-based logger
    return {
      debug: (...args: unknown[]) => console.debug("[DEBUG]", ...args),
      info: (...args: unknown[]) => console.info("[INFO]", ...args),
      warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
      error: (...args: unknown[]) => console.error("[ERROR]", ...args),
      fatal: (...args: unknown[]) => console.error("[FATAL]", ...args),
      trace: (...args: unknown[]) => console.trace("[TRACE]", ...args),
    } as unknown as pino.Logger;
  }
}

/**
 * Helper function to create structured log context for bootstrap operations
 */
export function createBootstrapContext(
  operation: string,
  additionalContext?: Record<string, unknown>,
) {
  const traceContext = extractTraceContext();
  return {
    operation,
    phase: "bootstrap",
    ...traceContext,
    ...additionalContext,
  };
}
