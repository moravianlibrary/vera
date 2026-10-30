// Optional OpenTelemetry setup, imported only when an endpoint is configured.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { context, logs, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
  BatchSpanProcessor,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from "@opentelemetry/sdk-trace";

export interface TestingExporters {
  spans: InMemorySpanExporter;
  logs: InMemoryLogRecordExporter;
}

export function setUp(
  endpoint: string,
  key: string | undefined,
  testing = false,
  supplied?: { spans: InMemorySpanExporter; logs: InMemoryLogRecordExporter },
) {
  const headers = key === undefined ? undefined : { authorization: key };
  const resource = resourceFromAttributes({
    "service.name": "vera-engine",
    "service.version": JSON.parse(readFileSync(join(import.meta.dir, "../../package.json"), "utf8"))
      .version,
    "deployment.environment": "development",
  });
  const spans = testing ? (supplied?.spans ?? new InMemorySpanExporter()) : undefined;
  const logRecords = testing ? (supplied?.logs ?? new InMemoryLogRecordExporter()) : undefined;
  const spanProcessor = testing
    ? new SimpleSpanProcessor({ exporter: spans ?? new InMemorySpanExporter() })
    : new BatchSpanProcessor({
        exporter: new OTLPTraceExporter({
          url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
          headers,
        }),
      });
  const logProcessor = testing
    ? new SimpleLogRecordProcessor({ exporter: logRecords ?? new InMemoryLogRecordExporter() })
    : new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${endpoint.replace(/\/$/, "")}/v1/logs`,
          headers,
        }),
      });
  const tracerProvider = new TracerProvider({ resource, spanProcessors: [spanProcessor] });
  const loggerProvider = new LoggerProvider({ resource, processors: [logProcessor] });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(tracerProvider);
  logs.setGlobalLoggerProvider(loggerProvider);
  return {
    tracerProvider,
    loggerProvider,
    tracer: tracerProvider.getTracer("vera-engine"),
    logger: loggerProvider.getLogger("vera-engine"),
    exporters: { spans, logs: logRecords },
  };
}
