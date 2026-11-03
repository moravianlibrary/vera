// A safe facade: callers can use it before the optional OpenTelemetry SDK loads.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Tracer } from "@opentelemetry/api";
import {
  context,
  logs,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import type { InMemoryLogRecordExporter } from "@opentelemetry/sdk-logs";
import type { InMemorySpanExporter } from "@opentelemetry/sdk-trace";
import { jobAttributesOf } from "./rules";

export const resourceAttributes: Record<string, string> = {
  "service.name": "vera-engine",
  "service.version": JSON.parse(readFileSync(join(import.meta.dir, "../../package.json"), "utf8"))
    .version,
  "deployment.environment": "development",
};

export interface TelemetrySettings {
  endpoint: string | undefined;
  key: string | undefined;
}
export interface TelemetryTesting {
  spans: InMemorySpanExporter;
  logs: InMemoryLogRecordExporter;
}
export interface ApiSpan {
  setUser(userId: () => string | null): void;
}
export type PluginOutcome = "answered" | "unavailable" | "refused";

type Runtime = {
  tracer: Tracer;
  logger: ReturnType<import("@opentelemetry/api").LoggerProvider["getLogger"]>;
  tracerProvider: { forceFlush(): Promise<void>; shutdown(): Promise<void> };
  loggerProvider: { forceFlush(): Promise<void>; shutdown(): Promise<void> };
  exporters: {
    spans: InMemorySpanExporter | undefined;
    logs: InMemoryLogRecordExporter | undefined;
  };
};
let runtime: Runtime | null = null;

export async function startTelemetry(
  settings: TelemetrySettings,
  testing?: TelemetryTesting,
): Promise<void> {
  if (!settings.endpoint || runtime !== null) return;
  const otel = await import("./otel");
  const started = otel.setUp(settings.endpoint, settings.key, testing !== undefined, testing);
  runtime = {
    ...started,
    exporters: testing === undefined ? started.exporters : testing,
  } as Runtime;
}

export async function stopTelemetry(): Promise<void> {
  if (runtime === null) return;
  const active = runtime;
  runtime = null;
  await Promise.all([active.tracerProvider.forceFlush(), active.loggerProvider.forceFlush()]);
  await Promise.all([active.tracerProvider.shutdown(), active.loggerProvider.shutdown()]);
  context.disable();
  trace.disable();
  propagation.disable();
  logs.disable();
}

export async function withApiSpan(
  request: Request,
  route: string,
  fn: (span: ApiSpan) => Promise<Response>,
): Promise<Response> {
  if (runtime === null) return fn({ setUser() {} });
  const carrier = { traceparent: request.headers.get("traceparent") ?? undefined };
  const parent = propagation.extract(ROOT_CONTEXT, carrier);
  return runtime.tracer.startActiveSpan(
    `${request.method} ${route}`,
    {
      kind: SpanKind.SERVER,
      attributes: { "http.request.method": request.method, "http.route": route },
    },
    parent,
    async (span) => {
      try {
        const response = await fn({
          setUser: (resolveUserId) => {
            const userId = resolveUserId();
            if (userId !== null) span.setAttribute("enduser.id", userId);
          },
        });
        span.setAttribute("http.response.status_code", response.status);
        if (response.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
        const body: { code?: unknown } | null = response.headers
          .get("Content-Type")
          ?.includes("application/problem+json")
          ? ((await response
              .clone()
              .json()
              .catch(() => null)) as { code?: unknown } | null)
          : null;
        if (typeof body?.code === "string") span.setAttribute("vera.problem.code", body.code);
        return response;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export function currentTraceParent(): string | null {
  if (runtime === null) return null;
  const spanContext = trace.getSpan(context.active())?.spanContext();
  if (spanContext === undefined) return null;
  return `00-${spanContext.traceId}-${spanContext.spanId}-${spanContext.traceFlags.toString(16).padStart(2, "0")}`;
}

export function withJobSpan<T>(
  kind: string,
  payload: unknown,
  traceParent: string | null,
  fn: () => T,
): T {
  if (runtime === null) return fn();
  const parent =
    traceParent === null
      ? context.active()
      : propagation.extract(ROOT_CONTEXT, { traceparent: traceParent });
  return runtime.tracer.startActiveSpan(
    `job ${kind}`,
    { attributes: jobAttributesOf(kind, payload) },
    parent,
    (span) => {
      try {
        const result = fn();
        span.setAttribute("vera.job.outcome", "done");
        return result;
      } catch (error) {
        span.setAttribute("vera.job.outcome", "failed");
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export function withPluginSpan<T>(
  instanceId: string,
  implementation: string,
  fn: () => T,
  outcomeOf: (result: T) => PluginOutcome,
): T {
  if (runtime === null) return fn();
  return runtime.tracer.startActiveSpan(
    `plugin ${implementation}`,
    {
      attributes: {
        "vera.plugin.instance": instanceId,
        "vera.plugin.implementation": implementation,
      },
    },
    (span) => {
      const finish = () => span.end();
      try {
        const result = fn();
        if (result !== null && typeof result === "object" && "then" in result) {
          return Promise.resolve(result).then(
            (value) => {
              span.setAttribute("vera.plugin.outcome", outcomeOf(value));
              finish();
              return value;
            },
            (error: unknown) => {
              span.setAttribute("vera.plugin.outcome", "unavailable");
              span.setStatus({ code: SpanStatusCode.ERROR });
              finish();
              throw error;
            },
          ) as T;
        }
        span.setAttribute("vera.plugin.outcome", outcomeOf(result));
        finish();
        return result;
      } catch (error) {
        span.setAttribute("vera.plugin.outcome", "unavailable");
        span.setStatus({ code: SpanStatusCode.ERROR });
        finish();
        throw error;
      }
    },
  );
}

export function logEvent(
  level: "info" | "warn" | "error",
  message: string,
  attributes: Record<string, string | number | boolean> = {},
): void {
  if (runtime === null) return;
  const severity = level === "error" ? 17 : level === "warn" ? 13 : 9;
  runtime.logger.emit({
    severityNumber: severity,
    severityText: level.toUpperCase(),
    body: message,
    attributes,
    context: context.active(),
  });
}
