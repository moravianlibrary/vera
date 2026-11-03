// Records catalogue events in History and the Audit outbox within the act's transaction.

import { heldRoleIdsOf } from "@vera/domain/access";
import type { Actor } from "@vera/domain/entities";
import {
  configurationDataSchema,
  type EventCode,
  eventCatalogue,
  eventEntrySchema,
  type HistoryCode,
  historyCodes,
  historyDataSchemas,
} from "@vera/domain/events";
import type { z } from "zod";
import type { Engine } from "./engine";
import type { Caller } from "./http/endpoint";
import { auditRecordOf, telemetryUserId } from "./telemetry/rules";
import { currentTraceParent } from "./telemetry/telemetry";

export interface EventInput<C extends EventCode> {
  code: C;
  subjectKind: (typeof eventCatalogue)[C]["subject"];
  subjectId: string;
  // Non-user subject names come from the caller; user names are read here, and only for staff.
  subjectName?: string;
  actor: Actor;
  correlationId: string;
  // An act that planned at a moment records at it.
  at?: string;
  data: C extends HistoryCode
    ? C extends keyof typeof historyDataSchemas
      ? z.infer<(typeof historyDataSchemas)[C]>
      : never
    : z.infer<typeof configurationDataSchema>;
  reason?: { public: string | null; internal: string | null };
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export function actorOf(caller: Caller | null): Actor {
  return caller === null ? { kind: "system" } : { kind: "user", userId: caller.userId };
}

export function configurationOf(changes: { field: string; from: unknown; to: unknown }[]) {
  return { changes };
}

export function recordEvent<C extends EventCode>(engine: Engine, input: EventInput<C>): void {
  const flags = eventCatalogue[input.code];
  if ((flags as { isDerived?: boolean }).isDerived || (!flags.history && !flags.audit))
    throw new Error(`Event ${input.code} cannot be recorded`);
  if (input.subjectKind !== flags.subject) throw new Error("Subject kind must match event code");
  const at = input.at ?? engine.clock.now().toISOString();
  if (flags.history) {
    if (!(historyCodes as readonly string[]).includes(input.code))
      throw new Error(`Event ${input.code} has no History schema`);
    const schema = historyDataSchemas[input.code as keyof typeof historyDataSchemas];
    const entry = eventEntrySchema.parse({
      id: `E-${crypto.randomUUID()}`,
      code: input.code,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      at,
      actor: input.actor,
      correlationId: input.correlationId,
      data: schema.parse(input.data),
      reason: input.reason ?? { public: null, internal: null },
    });
    engine.db
      .query(`INSERT INTO events
      (id,code,subject_kind,subject_id,at,actor,correlation_id,data,reason_public,reason_internal)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(
        entry.id,
        entry.code,
        entry.subjectKind,
        entry.subjectId,
        entry.at,
        JSON.stringify(entry.actor),
        entry.correlationId,
        JSON.stringify(entry.data),
        entry.reason.public,
        entry.reason.internal,
      );
  }
  if (flags.audit) {
    if (!(historyCodes as readonly string[]).includes(input.code))
      configurationDataSchema.parse(input.data);
    const actor = auditActor(engine, input.actor);
    const subjectName =
      input.subjectKind === "user" ? staffName(engine, input.subjectId) : input.subjectName;
    const record = auditRecordOf(
      {
        code: input.code,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        subjectName,
        correlationId: input.correlationId,
        data: input.data,
        actor,
        at,
        reason: input.reason,
      },
      { traceId: currentTraceParent()?.split("-")[1] ?? null },
    );
    engine.db
      .query("INSERT INTO audit_outbox (at,record) VALUES (?,?)")
      .run(at, JSON.stringify(record));
  }
}

function roleIdsOf(engine: Engine, userId: string): string[] {
  const rows = engine.db
    .query<
      { role_id: string; way: "hand" | "mapped"; instance_id: string | null; claim: string | null },
      [string, string]
    >(`SELECT role_id, 'hand' AS way, NULL AS instance_id, NULL AS claim
      FROM user_hand_roles WHERE user_id=?
      UNION ALL
      SELECT role_id, 'mapped' AS way, instance_id, claim
      FROM user_mapped_roles WHERE user_id=?`)
    .all(userId, userId);
  return heldRoleIdsOf({
    handRoleIds: rows.filter((row) => row.way === "hand").map((row) => row.role_id),
    mappedRoles: rows.flatMap((row) =>
      row.way === "mapped" && row.instance_id !== null && row.claim !== null
        ? [{ roleId: row.role_id, instanceId: row.instance_id, claim: row.claim }]
        : [],
    ),
  });
}

function staffName(engine: Engine, userId: string): string | undefined {
  const user = engine.db
    .query<{ name: string }, [string]>("SELECT name FROM users WHERE id=?")
    .get(userId);
  if (!user) return undefined;
  return telemetryUserId(userId, roleIdsOf(engine, userId)) === null ? undefined : user.name;
}

function auditActor(
  engine: Engine,
  actor: Actor,
): import("./telemetry/rules").AuditRecordInput["actor"] {
  if (actor.kind === "system") return actor;
  if (actor.kind === "undisclosed") return { kind: "reader" };
  const user = engine.db
    .query<{ name: string; kind: string }, [string]>("SELECT name,kind FROM users WHERE id=?")
    .get(actor.userId);
  if (!user) throw new Error(`Cannot record audit actor: no user ${actor.userId}`);
  const roleIds = roleIdsOf(engine, actor.userId);
  if (telemetryUserId(actor.userId, roleIds) === null) return { kind: "reader" as const };
  return user.kind === "agent"
    ? { kind: "agent" as const, userId: actor.userId, name: user.name }
    : { kind: "user" as const, userId: actor.userId, name: user.name };
}
