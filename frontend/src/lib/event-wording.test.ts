import { type EventCode, type EventEntry, historyCodes } from "@vera/domain/events";
import { describe, expect, it } from "vitest";
import { resources } from "@/i18n";
import { publicWordingOf, wordingOf } from "@/lib/event-wording";

function entry(
  code: EventCode,
  subjectKind: EventEntry["subjectKind"],
  data: EventEntry["data"],
): EventEntry {
  return {
    id: "e1",
    subjectKind,
    subjectId: "s1",
    at: "2026-01-01T00:00:00Z",
    actor: { kind: "system" },
    correlationId: "c1",
    reason: { public: null, internal: null },
    code,
    data,
  } as EventEntry;
}

describe("event wording", () => {
  it("has an English title for every History code", () => {
    for (const code of historyCodes) {
      expect(Object.keys(resources.en.history)).toContain(code);
      expect(resources.en.history[code as keyof typeof resources.en.history]).toBeTruthy();
    }
  });

  it("words representative entries for each subject kind", () => {
    expect(
      wordingOf(
        entry("request.created", "request", {
          batch: { id: "b1", name: "Batch one" },
          source: null,
        }),
        () => "",
      ).title,
    ).toBe("Asked for");
    expect(wordingOf(entry("iteration.ingested", "iteration", {}), () => "").title).toBe(
      "Ingested",
    );
    expect(
      wordingOf(
        entry("document.relinked", "document", { catalogId: { from: "old", to: "new" } }),
        () => "",
      ).line,
    ).toBe("old → new");
    expect(
      wordingOf(entry("list.created", "list", { generator: null, members: 12 }), () => "").line,
    ).toBe("12 members");
    expect(
      wordingOf(entry("project.approved", "project", { priority: "High", approved: 3 }), () => "")
        .line,
    ).toBe("3 proposals approved");
  });

  it("has the nine public wordings", () => {
    const words: [EventCode, string][] = [
      ["request.created", "Asked"],
      ["request.approved", "Accepted"],
      ["request.declined", "Not accepted"],
      ["request.withdrawn", "Withdrawn"],
      ["iteration.restricted", "Not available for digitization"],
      ["iteration.cancelled", "On hold"],
      ["iteration.not_digitizable", "Could not be digitized"],
      ["iteration.digitized", "Digitized"],
      ["iteration.published", "Available to read"],
    ];
    for (const [code, wording] of words) expect(publicWordingOf(code)).toBe(wording);
  });
});
