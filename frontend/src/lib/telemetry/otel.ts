// Optional browser OpenTelemetry setup, loaded only when an endpoint is configured.

import { context, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, StackContextManager, TracerProvider } from "@opentelemetry/sdk-trace";
import { onCLS, onINP, onLCP, onTTFB } from "web-vitals";
import { env } from "@/config/env";
import { redactedUrl } from "./rules";

export function setUp(endpoint: string, key: string | undefined) {
  const collector = `${endpoint.replace(/\/$/, "")}/v1/traces`;
  const provider = new TracerProvider({
    resource: resourceFromAttributes({
      "service.name": "vera-client",
      "service.version": import.meta.env.VITE_APP_VERSION ?? "dev",
      "deployment.environment": import.meta.env.MODE,
    }),
    spanProcessors: [
      new BatchSpanProcessor({
        exporter: new OTLPTraceExporter({
          url: collector,
          headers: key === undefined ? undefined : { authorization: key },
        }),
      }),
    ],
  });
  context.setGlobalContextManager(new StackContextManager().enable());
  trace.setGlobalTracerProvider(provider);

  const apiBase = new URL(env.VITE_API_BASE_URL, window.location.origin);
  const apiOrigin = apiBase.origin;
  const apiUrl = apiBase.href.replace(/\/$/, "");
  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [apiOrigin, apiUrl],
        ignoreUrls: [collector],
        applyCustomAttributesOnSpan: (span, request, result) => {
          const resultUrl =
            "url" in result && typeof result.url === "string" ? result.url : undefined;
          const url = request instanceof Request ? request.url : resultUrl;
          const clean = url === undefined || url === "" ? "" : redactedUrl(url);
          span.setAttribute("url.full", clean);
          span.setAttribute("http.url", clean);
        },
      }),
    ],
  });

  const tracer = trace.getTracer("vera-client");
  for (const vital of [onLCP, onINP, onCLS, onTTFB]) {
    vital((metric) => {
      const span = tracer.startSpan("web vital");
      span.setAttribute("vera.vital.name", metric.name);
      span.setAttribute("vera.vital.value", metric.value);
      span.setAttribute("vera.vital.rating", metric.rating);
      span.end();
    });
  }
  void import("./telemetry").then(({ recordError }) => {
    window.addEventListener("error", (event) => recordError(null, event.error ?? event.message));
    window.addEventListener("unhandledrejection", (event) => recordError(null, event.reason));
  });
  return tracer;
}
