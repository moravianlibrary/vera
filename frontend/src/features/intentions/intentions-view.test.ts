// Words on intention cards.

import { describe, expect, it } from "vitest";
import type { IntentionRow } from "@/api/intentions";
import type { Intention } from "@/domain/entities";
import { mixLabelOf, verdictBadgeOf } from "@/features/intentions/intentions-view";

const intention = (id: string, overrides: Partial<Intention> = {}): Intention => ({
  id,
  name: id,
  description: "",
  funding: { kind: "any" },
  projectId: null,
  scopeCategoryId: null,
  distributionId: "d1",
  targetPages: 1000,
  countsFrom: "2026-01-01",
  endsOn: "2026-12-31",
  isOverall: false,
  templateId: null,
  archived: null,
  ...overrides,
});

const row = (value: Intention, overrides: Partial<IntentionRow> = {}): IntentionRow => ({
  intention: value,
  state: "Running",
  timeElapsed: 0.5,
  daysToStart: 0,
  daysLeft: 100,
  evenPace: 0.5,
  verdict: null,
  pagesPerWeekNeeded: null,
  catchUpPages: null,
  plannedPages: 0,
  deliveredPages: 0,
  outputPages: 0,
  noDateCount: 0,
  noPagesCount: 0,
  project: null,
  scope: null,
  mix: { id: "d1", name: "House mix", revision: 4 },
  mixRows: [],
  unallocated: 0,
  outOfBandCount: 0,
  fill: [],
  lists: [],
  ...overrides,
});

const rows = [
  row(intention("late", { endsOn: "2026-12-31" }), { verdict: "behindPace" }),
  row(intention("soon", { endsOn: "2026-07-31" }), { verdict: "onPace" }),
  row(intention("open-far", { endsOn: null }), { deliveredPages: 900 }),
  row(intention("open-near", { endsOn: null }), { deliveredPages: 100 }),
  row(intention("next", { countsFrom: "2026-09-01" }), { state: "Upcoming" }),
  row(intention("may", { endsOn: "2026-05-31" }), {
    state: "Ended",
    verdict: "short",
    deliveredPages: 400,
  }),
  row(intention("gone", { archived: { actor: { kind: "system" }, at: "2026-06-01T00:00:00Z" } })),
  row(intention("watch", { targetPages: null }), { outOfBandCount: 2 }),
  row(intention("house", { targetPages: null, isOverall: true })),
];

describe("verdictBadgeOf", () => {
  it("says what an ended target fell short by", () => {
    expect(verdictBadgeOf(rows[5])).toEqual({ text: "Ended — 600 pp short", tone: "amber" });
    expect(
      verdictBadgeOf(row(intention("x"), { state: "Ended", verdict: "targetMet" }))?.text,
    ).toBe("Ended — target met");
  });
});

describe("mixLabelOf", () => {
  it("names the selected reusable mix", () => {
    expect(mixLabelOf(rows[0])).toBe("House mix");
    expect(mixLabelOf(rows[8])).toBe("House mix");
    expect(mixLabelOf(row(intention("x"), { mix: null }))).toBe("No mix");
  });
});
