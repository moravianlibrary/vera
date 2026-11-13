import { describe, expect, test } from "bun:test";
import {
  configurationDataSchema,
  type EventEntry,
  eventCatalogue,
  eventEntrySchema,
  historyCodes,
  historyDataSchemas,
  isPublicEntry,
  oncePerCause,
  publicEntryOf,
  withoutIngestError,
} from "./events";

const base = {
  id: "event-1",
  subjectKind: "request" as const,
  subjectId: "request-1",
  at: "2026-10-30T12:00:00.000Z",
  actor: { kind: "user" as const, userId: "user-1" },
  correlationId: "cause-1",
  reason: { public: "A public reason", internal: "An internal reason" },
};

describe("event catalogue and entries (EVENT-catalogue, EVENT-shape)", () => {
  test("has the catalogue destination counts", () => {
    const codes = Object.values(eventCatalogue);
    expect(codes.filter((flags) => flags.history)).toHaveLength(48);
    expect(codes.filter((flags) => flags.hook && !flags.history)).toHaveLength(3);
    expect(codes.filter((flags) => flags.audit && !flags.history)).toHaveLength(58);
    expect(codes).toHaveLength(109);
  });

  test("lists only list.started as derived and sends it only to hooks", () => {
    const derived = Object.entries(eventCatalogue).filter(
      ([, flags]) => "isDerived" in flags && flags.isDerived,
    );
    expect(derived.map(([code]) => code)).toEqual(["list.started"]);
    expect(derived[0]?.[1]).toMatchObject({ history: false, hook: true, audit: false });
  });

  test("has typed data schemas for every History code", () => {
    expect(Object.keys(historyDataSchemas).sort()).toEqual([...historyCodes].sort());
    expect(configurationDataSchema.safeParse({ changes: [] }).success).toBe(true);
  });

  test("allows an approved request with approved data and rejects declined data", () => {
    const approved = {
      ...base,
      code: "request.approved" as const,
      data: { iterationId: "iteration-1", isRescan: false, batchSize: null, suggestion: null },
    };
    expect(eventEntrySchema.safeParse(approved).success).toBe(true);
    expect(
      eventEntrySchema.safeParse({
        ...approved,
        data: { batchSize: null },
      }).success,
    ).toBe(false);
  });

  test("requires the subject kind named by the code", () => {
    expect(
      eventEntrySchema.safeParse({
        ...base,
        code: "request.created",
        subjectKind: "list",
        data: { batch: null, source: null },
      }).success,
    ).toBe(false);
  });

  test("keeps the data type paired with its code", () => {
    const entry = eventEntrySchema.parse({
      ...base,
      code: "list.renamed",
      subjectKind: "list",
      data: { name: { from: "Old", to: "New" } },
    });
    if (entry.code === "list.renamed") {
      if (entry.data !== null) {
        const newName: string = entry.data.name.to;
        expect(newName).toBe("New");
      }
    }
  });

  test("only a forbidden restriction can be public", () => {
    const forbidden = eventEntrySchema.parse({
      ...base,
      subjectKind: "iteration",
      code: "iteration.restricted",
      data: { rule: { id: "rule-1", name: "Copyright" }, outcome: "forbidden" },
    });
    if (forbidden.code !== "iteration.restricted" || forbidden.data === null)
      throw new Error("Expected restriction data");
    const restricted: EventEntry = {
      ...forbidden,
      data: { ...forbidden.data, outcome: "restricted" },
    };
    expect(isPublicEntry(forbidden)).toBe(true);
    expect(isPublicEntry(restricted)).toBe(false);
  });

  test("withholds public data, the internal reason and staff identity", () => {
    const entry = eventEntrySchema.parse({
      ...base,
      code: "request.created",
      data: { batch: null, source: null },
    });
    const publicEntry = publicEntryOf(entry);
    expect(publicEntry.data).toBeNull();
    expect(publicEntry.reason).toEqual({ public: "A public reason", internal: null });
    expect(publicEntry.actor).toEqual({ kind: "undisclosed" });
  });

  test("keeps system actors and removes ingest errors", () => {
    const failedIngest = eventEntrySchema.parse({
      ...base,
      subjectKind: "iteration",
      actor: { kind: "system" },
      code: "iteration.ingest_failed",
      data: { attempt: 2, error: "private error" },
    });
    expect(publicEntryOf(failedIngest).actor).toEqual({ kind: "system" });
    expect(withoutIngestError(failedIngest)).toMatchObject({
      data: { attempt: 2, error: null },
    });
  });

  test("keeps one entry per cause and code", () => {
    const first = { ...base, code: "request.created" as const };
    const duplicate = { ...first, id: "event-2" };
    const otherCode = { ...first, id: "event-3", code: "request.approved" as const };
    expect(oncePerCause([first, duplicate, otherCode])).toEqual([first, otherCode]);
  });
});
