import { describe, expect, it } from "bun:test";
import { hookDraftSchema, hookEventSchema, hookGroupOfEvent, hookGroups } from "./hooks";

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

  it("requires at least one distinct subscription event", () => {
    const draft = {
      name: "hook",
      filter: "",
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
