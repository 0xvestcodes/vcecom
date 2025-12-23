import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from "@nestjs/common";
import { ContextService } from "../logging/context.service";
import {
  ErrorResponse,
  ExtendedRequest,
  ExtendedResponse,
  HttpExceptionResponse,
} from "../logging/types";

/**
 * Global exception filter that captures all exceptions
 * Logs full error details with context and returns sanitized responses
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly contextService: ContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ExtendedResponse>();
    const request = ctx.getRequest<ExtendedRequest>();

    // Get logger from request (attached by nestjs-pino or context middleware)
    const logger = request.logger || {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };

    // Get request context
    const requestContext =
      this.contextService.get() ||
      response.requestContext ||
      ({} as Partial<import("../logging/context.service").RequestContext>);
    const requestId = requestContext.requestId || "unknown";

    // Handle multer file size errors
    if (
      exception &&
      typeof exception === "object" &&
      "code" in exception &&
      exception.code === "LIMIT_FILE_SIZE"
    ) {
      const payloadTooLargeException = new PayloadTooLargeException(
        "File size exceeds maximum allowed size of 50MB",
      );
      exception = payloadTooLargeException;
    }

    // Determine status code and message
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    // Extract error details
    const errorDetails = {
      name: exception instanceof Error ? exception.name : "UnknownError",
      message:
        exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    // Skip logging for favicon and static assets (normal browser behavior)
    const isStaticAsset = request.url?.match(
      /^\/(favicon\.ico|robots\.txt|.*\.(ico|png|jpg|jpeg|gif|svg|css|js))$/i,
    );

    // Build log context
    const logContext = {
      requestId,
      traceId: requestContext.traceId,
      spanId: requestContext.spanId,
      correlationId: requestContext.correlationId,
      method: request.method,
      url: request.url,
      statusCode: status,
      customerId: requestContext.customerId,
      cartId: requestContext.cartId,
      orderId: requestContext.orderId,
      checkoutId: requestContext.checkoutId,
      error: errorDetails,
    };

    // Log error with full context (skip static assets)
    if (!isStaticAsset) {
      if (status >= 500) {
        logger.error(logContext, "Unhandled exception");
      } else if (status === 404) {
        // Log 404s at debug level (not warning) - they're often expected
        logger.debug(logContext, "Resource not found");
      } else {
        logger.warn(logContext, "Client error");
      }
    }

    // Return sanitized response (no stack traces to clients)
    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url || "",
      requestId,
    };

    if (typeof message === "string") {
      errorResponse.message = message;
    } else if (typeof message === "object") {
      const httpMessage = message as HttpExceptionResponse;
      errorResponse.message =
        (httpMessage.message as string) || "An error occurred";
      if (httpMessage.error) {
        errorResponse.error = httpMessage.error;
      }
    }

    // In development, include more details
    if (process.env.NODE_ENV === "development") {
      errorResponse.error = errorDetails.name;
    }

    response.status(status).json(errorResponse);
  }
}
