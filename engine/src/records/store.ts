import type { StoredBatch } from "@vera/domain/batches";
import type { Document, Iteration, Project, Request, StatusLogEntry } from "@vera/domain/entities";
import type { StoredPropertyDefinition } from "@vera/domain/properties";
import type { StoredRequestCustody } from "@vera/domain/request-custody";
import type { RecordStore } from "@vera/domain/store";
import { accessUser, groupsOf, rawCustodiesOf } from "../access/index";
import { rolesOf } from "../access/session";
import type { Engine } from "../engine";

export function pragueMidnightOf(at: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZoneName: "longOffset",
  });
  const parts = formatter.formatToParts(at);
  const day = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const offset = zone === "GMT" ? "Z" : zone.replace("GMT", "");
  return new Date(`${day}T00:00:00${offset}`);
}

export function engineStore(engine: Engine): RecordStore {
  const all = <T>(sql: string): T[] =>
    engine.db
      .query<{ record: string }, []>(sql)
      .all()
      .map(({ record }) => JSON.parse(record) as T);
  const users = engine.db
    .query<{ id: string }, []>("SELECT id FROM users ORDER BY rowid")
    .all()
    .flatMap(({ id }) => {
      const access = accessUser(engine, id);
      return access
        ? [{ id: access.id, name: access.name, kind: access.kind, email: access.email }]
        : [];
    });
  const catalogPropertyKeys = new Set(
    engine.db
      .query<{ versions: string }, []>(
        "SELECT versions FROM plugin_implementations WHERE kind='CatalogAdapter' ORDER BY rowid",
      )
      .all()
      .flatMap(({ versions }) =>
        (JSON.parse(versions) as { declares?: { properties?: { key: string }[] } }[]).flatMap(
          (v) => v.declares?.properties?.map((p) => p.key) ?? [],
        ),
      ),
  );
  const categories = engine.db
    .query<{ id: string; name: string; parent_id: string | null }, []>(
      "SELECT * FROM categories ORDER BY rowid",
    )
    .all()
    .map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id }));
  return {
    today: pragueMidnightOf(engine.clock.now()),
    catalogPropertyKeys,
    users,
    roles: rolesOf(engine.db),
    groups: groupsOf(engine),
    categories,
    projects: all<Project>("SELECT record FROM projects ORDER BY rowid"),
    batches: all<StoredBatch>("SELECT record FROM batches ORDER BY rowid"),
    documents: all<Document>("SELECT record FROM documents ORDER BY rowid"),
    iterations: all<Iteration>("SELECT record FROM iterations ORDER BY rowid"),
    requests: all<Request>("SELECT record FROM requests ORDER BY rowid"),
    propertyDefinitions: all<StoredPropertyDefinition>(
      "SELECT record FROM property_definitions ORDER BY rowid",
    ),
    requestCustodies: rawCustodiesOf(engine).map(
      ({ id, name, description, isFallback, memberIds, groupIds }): StoredRequestCustody => ({
        id,
        name,
        description,
        isFallback,
        memberIds,
        groupIds,
      }),
    ),
    statusLog: engine.db
      .query<
        {
          id: string;
          code: string;
          subject_kind: string;
          subject_id: string;
          at: string;
          actor: string;
          correlation_id: string;
          data: string;
          reason_public: string | null;
          reason_internal: string | null;
        },
        []
      >("SELECT * FROM events ORDER BY rowid")
      .all()
      .map(
        (e) =>
          ({
            id: e.id,
            code: e.code as StatusLogEntry["code"],
            subjectKind: e.subject_kind as StatusLogEntry["subjectKind"],
            subjectId: e.subject_id,
            at: e.at,
            actor: JSON.parse(e.actor) as StatusLogEntry["actor"],
            correlationId: e.correlation_id,
            data: JSON.parse(e.data) as StatusLogEntry["data"],
            reason: { public: e.reason_public, internal: e.reason_internal },
          }) as unknown as StatusLogEntry,
      ),
  };
}
