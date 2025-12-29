import { Injectable } from "@nestjs/common";
import { context, Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../logging/context.service";
import { createLogContext } from "../logging/logging.helper";

export interface SpanOptions {
  /** Operation name for the span */
  operation: string;
  /** Additional attributes to add to the span */
  attributes?: Record<string, string | number | boolean>;
  /** Whether to log span start/end */
  logLifecycle?: boolean;
  /** Additional context for logging */
  logContext?: Record<string, unknown>;
}

export interface SpanResult<_T> {
  /** The created span */
  span: Span;
  /** Logger with trace/span IDs included */
  logger: PinoLogger;
  /** Execute a function within the span context */
  execute: <R>(fn: () => R | Promise<R>) => Promise<R>;
}

/**
 * Service for creating OpenTelemetry spans with integrated logging
 * Provides utilities for creating spans and ensuring logs include trace/span IDs
 * Only active if OTEL_EXPORTER_ZIPKIN_ENDPOINT is set
 */
@Injectable()
export class TracingService {
  private readonly tracer = trace.getTracer("vcecom-backend");
  private readonly isTracingEnabled: boolean;

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    // Check if tracing is enabled
    this.isTracingEnabled = !!process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT;
  }

  /**
   * Start a new span with integrated logging
   * Creates a span and returns a logger that includes trace/span IDs
   * Returns a no-op implementation if tracing is disabled
   */
  startSpan<T = void>(options: SpanOptions): SpanResult<T> {
    // Return no-op implementation if tracing is disabled
    if (!this.isTracingEnabled) {
      const noOpSpan = {
        setAttribute: () => {},
        setAttributes: () => {},
        addEvent: () => {},
        addLink: () => {},
        addLinks: () => {},
        setStatus: () => {},
        updateName: () => {},
        end: () => {},
        isRecording: () => false,
        spanContext: () => ({
          traceId: "",
          spanId: "",
          traceFlags: 0,
        }),
        setSpanContext: () => {},
        recordException: () => {},
      } as unknown as Span;

      return {
        span: noOpSpan,
        logger: this.logger,
        execute: async <R>(fn: () => R | Promise<R>) => {
          return fn();
        },
      };
    }

    const {
      operation,
      attributes = {},
      logLifecycle = true,
      logContext = {},
    } = options;

    // Get parent span context if available
    const parentSpan = trace.getActiveSpan();
    const parentContext = parentSpan
      ? trace.setSpan(context.active(), parentSpan)
      : context.active();

    // Create new span
    const span = this.tracer.startSpan(
      operation,
      {
        attributes: {
          "operation.name": operation,
          ...attributes,
        },
      },
      parentContext,
    );

    // Set span in context
    const spanContext = trace.setSpan(context.active(), span);

    // Create logger with trace/span IDs
    const spanContextData = span.spanContext();
    const childLogger = this.logger.logger.child({
      traceId: spanContextData.traceId,
      spanId: spanContextData.spanId,
      operation,
      ...logContext,
    });

    // Log span start if requested
    if (logLifecycle) {
      childLogger.debug(
        {
          ...createLogContext(this.contextService, operation, logContext),
          traceId: spanContextData.traceId,
          spanId: spanContextData.spanId,
        },
        `Starting span: ${operation}`,
      );
    }

    // Execute function within span context
    const execute = async <R>(fn: () => R | Promise<R>): Promise<R> => {
      return context.with(spanContext, async () => {
        try {
          const result = await fn();

          // Set span status to OK
          span.setStatus({ code: SpanStatusCode.OK });

          // Log span end if requested
          if (logLifecycle) {
            childLogger.debug(
              {
                ...createLogContext(this.contextService, operation, logContext),
                traceId: spanContextData.traceId,
                spanId: spanContextData.spanId,
              },
              `Completed span: ${operation}`,
            );
          }

          return result;
        } catch (error) {
          // Set span status to ERROR
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });

          // Record exception
          span.recordException(
            error instanceof Error ? error : new Error(String(error)),
          );

          // Log error
          childLogger.error(
            {
              ...createLogContext(this.contextService, operation, logContext),
              traceId: spanContextData.traceId,
              spanId: spanContextData.spanId,
              error:
                error instanceof Error
                  ? {
                      name: error.name,
                      message: error.message,
                      stack: error.stack,
                    }
                  : { type: typeof error, value: String(error) },
            },
            `Span error: ${operation}`,
          );

          throw error;
        } finally {
          span.end();
        }
      });
    };

    return {
      span,
      logger: {
        ...this.logger,
        logger: childLogger,
      } as PinoLogger,
      execute,
    };
  }

  /**
   * Get the current active span
   */
  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Get trace and span IDs from current context
   */
  getTraceContext(): { traceId?: string; spanId?: string } {
    const activeSpan = this.getActiveSpan();
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
  }

  /**
   * Create a logger with current trace context
   */
  getLogger(
    operation: string,
    additionalContext?: Record<string, unknown>,
  ): PinoLogger {
    const traceContext = this.getTraceContext();
    const childLogger = this.logger.logger.child({
      operation,
      ...traceContext,
      ...additionalContext,
    });

    return {
      ...this.logger,
      logger: childLogger,
    } as PinoLogger;
  }
}
