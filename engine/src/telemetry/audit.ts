// Delivers the durable audit outbox to the configured OTLP collector.
import type { Engine } from "../engine";
import { resourceAttributes, type TelemetrySettings } from "./telemetry";

interface AuditRecord {
  code: string;
  at: string;
  traceId: string | null;
  subject: { kind: string; id: string; name: string | null };
  correlationId: string;
  actor: { kind: string; userId?: string; name?: string };
  changes: unknown[];
  data: unknown;
}
interface Row {
  id: number;
  at: string;
  record: string;
}

export async function sendAudit(
  engine: Engine,
  settings: TelemetrySettings,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = fetch,
  limit = 500,
): Promise<{ sent: number; kept: number }> {
  if (!settings.endpoint) return { sent: 0, kept: 0 };
  const rows = engine.db
    .query<Row, [number]>("SELECT id,at,record FROM audit_outbox ORDER BY id LIMIT ?")
    .all(limit);
  if (!rows.length) return { sent: 0, kept: 0 };
  const attributes = (record: AuditRecord) => {
    const values: { key: string; value: { stringValue: string } }[] = [
      attr("vera.stream", "audit"),
      attr("vera.event.code", record.code),
      attr("vera.subject.kind", record.subject.kind),
      attr("vera.subject.id", record.subject.id),
      attr("vera.correlation_id", record.correlationId),
      attr("vera.actor.kind", record.actor.kind),
      attr("vera.changes", JSON.stringify(record.changes)),
      attr("vera.data", JSON.stringify(record.data)),
    ];
    if (record.subject.name !== null) values.push(attr("vera.subject.name", record.subject.name));
    if (record.actor.userId !== undefined) values.push(attr("enduser.id", record.actor.userId));
    if (record.actor.name !== undefined) values.push(attr("vera.actor.name", record.actor.name));
    return values;
  };
  const body = {
    resourceLogs: [
      {
        resource: {
          attributes: Object.entries(resourceAttributes).map(([key, value]) => attr(key, value)),
        },
        scopeLogs: [
          {
            scope: { name: "vera.audit" },
            logRecords: rows.map(({ at, record: raw }) => {
              const record = JSON.parse(raw) as AuditRecord;
              return {
                timeUnixNano: String(BigInt(Date.parse(at)) * 1_000_000n),
                severityNumber: 9,
                body: { stringValue: record.code },
                ...(record.traceId ? { traceId: record.traceId } : {}),
                attributes: attributes(record),
              };
            }),
          },
        ],
      },
    ],
  };
  try {
    const response = await fetchImpl(`${settings.endpoint.replace(/\/$/, "")}/v1/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.key ? { authorization: settings.key } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { sent: 0, kept: rows.length };
    const ids = rows.map(({ id }) => id);
    engine.db
      .query(`DELETE FROM audit_outbox WHERE id IN (${ids.map(() => "?").join(",")})`)
      .run(...ids);
    return { sent: rows.length, kept: 0 };
  } catch {
    return { sent: 0, kept: rows.length };
  }
}
function attr(key: string, value: string) {
  return { key, value: { stringValue: value } };
}
