// Pure rules for what the engine is allowed to record.
import { type EventCode, eventCatalogue } from "@vera/domain/events";

export function telemetryUserId(userId: string | null, roleIds: readonly string[]): string | null {
  return userId === null || roleIds.every((role) => role === "reader") ? null : userId;
}

export function routeTemplateOf(endpointPath: string | null): string {
  return endpointPath === null ? "/api/*" : `/api${endpointPath}`;
}

export function jobAttributesOf(kind: string, payload: unknown): Record<string, string> {
  const attributes: Record<string, string> = { "vera.job.kind": kind };
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return attributes;
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith("Id") && typeof value === "string") attributes[key] = value;
  }
  return attributes;
}

export interface AuditRecordInput {
  code: string;
  subjectKind: string;
  subjectId: string;
  subjectName?: string;
  correlationId: string;
  actor:
    | { kind: "user"; userId: string; name: string }
    | { kind: "reader" }
    | { kind: "agent"; userId: string; name: string }
    | { kind: "system" };
  data: unknown;
  at: string;
  reason?: unknown;
}

export function auditRecordOf(input: AuditRecordInput, context: { traceId: string | null }) {
  const configuration = input.data as { changes?: unknown } | null;
  const isConfiguration = !eventCatalogue[input.code as EventCode].history;
  return {
    code: input.code,
    at: input.at,
    correlationId: input.correlationId,
    traceId: context.traceId,
    subject: { kind: input.subjectKind, id: input.subjectId, name: input.subjectName ?? null },
    actor: input.actor,
    changes: isConfiguration ? (configuration?.changes ?? []) : [],
    data: isConfiguration ? null : input.data,
  };
}
