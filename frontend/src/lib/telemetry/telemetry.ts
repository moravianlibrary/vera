// A safe facade for client telemetry; callers can use it before the optional SDK loads.

import type { Tracer } from "@opentelemetry/api";
import { env } from "@/config/env";

let tracer: Tracer | null = null;
let userId: string | null = null;

export async function startTelemetry(): Promise<void> {
  if (env.VITE_OTEL_ENDPOINT === undefined || tracer !== null) return;
  const otel = await import("./otel");
  tracer = otel.setUp(env.VITE_OTEL_ENDPOINT, env.VITE_OTEL_KEY);
}

export function setTelemetryUser(id: string | null): void {
  userId = id;
}

function record(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
): void {
  if (tracer === null) return;
  const span = tracer.startSpan(name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) span.setAttribute(key, value);
  }
  if (userId !== null) span.setAttribute("enduser.id", userId);
  span.end();
}

export function recordPageView(routeTemplate: string): void {
  record("page view", {
    "vera.route": routeTemplate,
    "vera.tier": document.documentElement.dataset.tier,
  });
}

export function recordAct(act: string, outcome: "done" | "refused", status?: number): void {
  record("act", {
    "vera.act": act,
    "vera.outcome": outcome,
    "http.response.status_code": status,
  });
}

export function recordError(reference: string | null, error: unknown): void {
  const exceptionType = error instanceof Error ? error.name : typeof error;
  const exceptionMessage = error instanceof Error ? error.message : String(error);
  record("error", {
    ...(reference === null ? {} : { "vera.crash.reference": reference }),
    "exception.type": exceptionType,
    "exception.message": exceptionMessage.slice(0, 300),
  });
}
