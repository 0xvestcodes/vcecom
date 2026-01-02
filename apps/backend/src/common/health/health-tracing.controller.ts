import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { trace } from "@opentelemetry/api";
import { Public } from "../decorators/public.decorator";

@ApiTags("admin")
@Controller("_health")
@Public()
export class HealthTracingController {
  @Get("tracing")
  @ApiOperation({
    summary: "Tracing health check",
    description: "Returns OpenTelemetry tracing system status",
  })
  @ApiResponse({
    status: 200,
    description: "Tracing health status",
  })
  getTracingHealth() {
    const tracerProvider = trace.getTracerProvider();
    const tracer = tracerProvider.getTracer("vcecom-backend");
    const isTracingEnabled = process.env.OTEL_TRACE_ENABLED !== "false";

    // Get sampling rate
    const samplingRate = parseFloat(process.env.OTEL_TRACE_SAMPLING || "1.0");

    // Get OTLP endpoint
    const otlpEndpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318/v1/traces";

    // Try to create a test span
    let spanStatus = "OK";
    try {
      const span = tracer.startSpan("health-check");
      span.end();
    } catch (_error) {
      spanStatus = "ERROR";
    }

    return {
      status: isTracingEnabled && spanStatus === "OK" ? "OK" : "ERROR",
      enabled: isTracingEnabled,
      tracerProvider: {
        status: tracerProvider ? "OK" : "ERROR",
      },
      exporter: {
        type: "otlp",
        endpoint: otlpEndpoint,
      },
      sampling: {
        rate: samplingRate,
        percentage: `${(samplingRate * 100).toFixed(1)}%`,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
