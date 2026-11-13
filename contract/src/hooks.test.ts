import { describe, expect, it } from "bun:test";
import {
  hookDraftSchema,
  hookEventSchema,
  hookGroupOfEvent,
  hookGroups,
  subjectKindOfEvent,
} from "./hooks";

const rows = [
  ["Requests", ["request.created", "request.approved", "request.declined", "request.held"]],
  [
    "Documents",
    [
      "iteration.ingested",
      "iteration.ingest_failed",
      "iteration.verdict_accepted",
      "iteration.verdict_denied",
      "iteration.verdict_revoked",
      "iteration.restricted",
      "iteration.reclassified",
      "iteration.cancelled",
      "iteration.not_digitizable",
      "iteration.listed",
      "iteration.digitized",
      "iteration.published",
      "iteration.link_added",
      "iteration.link_changed",
      "iteration.link_made_primary",
      "iteration.link_removed",
    ],
  ],
  [
    "Records",
    [
      "document.relinked",
      "document.property_changed",
      "iteration.property_changed",
      "document.registry_changed",
    ],
  ],
  [
    "Lists",
    [
      "list.created",
      "list.dates_moved",
      "list.started_early",
      "list.started",
      "list.marked_done",
      "list.deleted",
    ],
  ],
  ["Tasks", ["run.finished", "run.failed"]],
] as const;

describe("hook event contract", () => {
  it("puts every hookable catalogue code in exactly one reference group", () => {
    const expected = new Map(
      rows.flatMap(([group, codes]) => codes.map((code) => [code, group] as const)),
    );
    expect(expected.size).toBe(hookEventSchema.options.length);
    for (const code of hookEventSchema.options) {
      expect(rows.filter(([, codes]) => (codes as readonly string[]).includes(code))).toHaveLength(
        1,
      );
      const group = expected.get(code);
      expect(group).toBeDefined();
      if (group !== undefined) expect(hookGroupOfEvent(code)).toBe(group);
    }
    expect([...hookGroups]).toEqual(rows.map(([group]) => group));
  });

  it("maps every hookable event to its subject page", () => {
    for (const [group, codes] of rows) {
      const kind =
        group === "Requests"
          ? "requests"
          : group === "Lists"
            ? "lists"
            : group === "Tasks"
              ? "tasks"
              : "documents";
      for (const code of codes) expect(subjectKindOfEvent(code)).toBe(kind);
    }
  });

  it("refuses conditions for unpicked kinds and malformed page filters", () => {
    const draft = {
      name: "hook",
      events: ["iteration.published"],
      conditions: {},
      channelId: "channel",
      recipient: "someone",
      message: "",
      batch: null,
      retry: { attempts: 1, backoff: "fixed" },
    };
    expect(
      hookDraftSchema.safeParse({ ...draft, conditions: { documents: { category: "c2" } } })
        .success,
    ).toBe(true);
    expect(
      hookDraftSchema.safeParse({ ...draft, conditions: { documents: undefined } }).success,
    ).toBe(true);
    for (const [conditions, code] of [
      [{ lists: {} }, "hook.condition_kind"],
      [{ documents: { progress: "unknown" } }, "hook.condition_invalid"],
      [{ documents: { pages: "bad" } }, "hook.condition_invalid"],
      [{ documents: { unknown: "value" } }, "hook.condition_invalid"],
    ] as const) {
      const result = hookDraftSchema.safeParse({ ...draft, conditions });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues[0];
        expect(issue?.code === "custom" ? issue.params?.code : null).toBe(code);
      }
    }
  });

  it("requires at least one distinct subscription event", () => {
    const draft = {
      name: "hook",
      conditions: {},
      channelId: "channel",
      recipient: "someone",
      message: "",
      batch: null,
      retry: { attempts: 1, backoff: "fixed" },
    };
    expect(hookDraftSchema.safeParse({ ...draft, events: [] }).success).toBe(false);
    const repeated = hookDraftSchema.safeParse({
      ...draft,
      events: ["list.created", "list.created"],
    });
    expect(repeated.success).toBe(false);
    if (!repeated.success) expect(repeated.error.issues[0]?.message).toBe("Pick each event once");
  });
});
