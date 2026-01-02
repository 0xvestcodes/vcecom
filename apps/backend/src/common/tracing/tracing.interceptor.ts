import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import {
  context as otelContext,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { PinoLogger } from "nestjs-pino";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ContextService } from "../logging/context.service";
import { createLogContext } from "../logging/logging.helper";
import { ExtendedRequest } from "../logging/types";

/**
 * Interceptor that creates OpenTelemetry spans for controller endpoints
 * Automatically creates spans for each request and logs with trace context
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly tracer = trace.getTracer("vcecom-backend");
  private readonly isTracingEnabled: boolean;
  private hasWarnedAboutInvalidTraceId = false;

  constructor(
    private readonly logger: PinoLogger,
    private readonly contextService: ContextService,
  ) {
    // Check if tracing is enabled
    this.isTracingEnabled = !!(
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Skip tracing if not enabled
    if (!this.isTracingEnabled) {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<ExtendedRequest>();
    const response = context.switchToHttp().getResponse();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Create operation name from route
    const method = request.method;
    const route = request.route?.path || request.url;
    const operation = `${method} ${route}`;
    const operationName = `${controller.name}.${handler.name}`;

    // Get parent span context if available
    const parentSpan = trace.getActiveSpan();
    const parentContext = parentSpan
      ? trace.setSpan(otelContext.active(), parentSpan)
      : otelContext.active();

    // Create span for this endpoint
    const span = this.tracer.startSpan(
      operationName,
      {
        attributes: {
          "operation.name": operationName,
          "http.method": method,
          "http.route": route,
          "http.url": request.url,
          "controller.name": controller.name,
          "handler.name": handler.name,
        },
      },
      parentContext,
    );

    // Set span in context
    const spanContext = trace.setSpan(otelContext.active(), span);

    // Get trace/span IDs
    const spanContextData = span.spanContext();

    // Validate trace ID - if it's all zeros, tracing SDK is not properly initialized
    const isValidTraceId =
      spanContextData.traceId &&
      spanContextData.traceId !== "00000000000000000000000000000000";

    // Warn once if tracing is enabled but SDK is not properly initialized
    if (!isValidTraceId && !this.hasWarnedAboutInvalidTraceId) {
      this.hasWarnedAboutInvalidTraceId = true;
      this.logger.warn(
        {
          ...createLogContext(this.contextService, "tracingInit"),
          traceId: spanContextData.traceId,
          spanId: spanContextData.spanId,
        },
        "OpenTelemetry tracing is enabled but SDK is not properly initialized. Trace IDs will not be included in logs. Check OTEL_EXPORTER_OTLP_ENDPOINT and ensure tracing SDK started successfully.",
      );
    }

    // Only include trace/span IDs if they're valid
    const traceContext = isValidTraceId
      ? {
          traceId: spanContextData.traceId,
          spanId: spanContextData.spanId,
        }
      : {};

    // Create logger with trace/span IDs (only if valid)
    const childLogger = this.logger.logger.child({
      ...traceContext,
      operation: operationName,
      method,
      route,
    });

    // Log request start
    childLogger.info(
      {
        ...createLogContext(this.contextService, operationName, {
          method,
          route,
          url: request.url,
        }),
        ...traceContext,
      },
      `Handling request: ${operation}`,
    );

    const startTime = Date.now();
    let spanEnded = false;

    // Helper to finalize span with status code
    const finalizeSpan = (statusCode: number, error?: Error) => {
      if (spanEnded) return;
      spanEnded = true;

      const elapsedMs = Date.now() - startTime;

      // Set span status based on HTTP status code
      if (statusCode >= 500) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error?.message || `HTTP ${statusCode}`,
        });
      } else if (statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error?.message || `HTTP ${statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.setAttribute("http.status_code", statusCode);
      span.setAttribute("duration_ms", elapsedMs);

      if (error && statusCode >= 400) {
        span.recordException(error);
      }

      // Log response
      if (statusCode >= 500) {
        childLogger.error(
          {
            ...createLogContext(this.contextService, operationName, {
              method,
              route,
              elapsedMs,
              statusCode,
              error: error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : undefined,
            }),
            ...traceContext,
          },
          `Request error: ${operation} (${elapsedMs}ms)`,
        );
      } else if (statusCode >= 400) {
        childLogger.warn(
          {
            ...createLogContext(this.contextService, operationName, {
              method,
              route,
              elapsedMs,
              statusCode,
            }),
            ...traceContext,
          },
          `Request completed with status ${statusCode}: ${operation} (${elapsedMs}ms)`,
        );
      } else {
        childLogger.info(
          {
            ...createLogContext(this.contextService, operationName, {
              method,
              route,
              elapsedMs,
              statusCode,
            }),
            ...traceContext,
          },
          `Completed request: ${operation} (${elapsedMs}ms)`,
        );
      }

      span.end();
    };

    // Listen for response finish to get actual status code
    const finishHandler = () => {
      finalizeSpan(response.statusCode || 200);
    };
    response.once("finish", finishHandler);

    // Execute handler within span context
    return otelContext.with(spanContext, () => {
      return next.handle().pipe(
        tap({
          error: (error) => {
            const errorObj =
              error instanceof Error ? error : new Error(String(error));
            const httpStatus =
              error instanceof HttpException ? error.getStatus() : 500;
            // Remove finish listener since we're handling error here
            response.removeListener("finish", finishHandler);
            finalizeSpan(httpStatus, errorObj);
          },
        }),
      );
    });
  }
}
