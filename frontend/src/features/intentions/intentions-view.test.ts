// How the Intentions page arranges the server's rows: the two columns and their order, the tile
// that counts intentions, the verdict words and what the URL picks.

import { describe, expect, it } from "vitest";
import type { IntentionRow } from "@/api/intentions";
import type { Intention } from "@/domain/entities";
import {
  columnSectionsOf,
  intentionsUrlStateOf,
  mixLabelOf,
  tileOf,
  verdictBadgeOf,
} from "@/features/intentions/intentions-view";

const intention = (id: string, overrides: Partial<Intention> = {}): Intention => ({
  id,
  name: id,
  description: "",
  funding: { kind: "any" },
  projectId: null,
  scopeCategoryId: null,
  tracksMixOf: "overall",
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
  mix: {
    id: "d1",
    name: "House mix",
    revision: 4,
    owner: { id: "overall", name: "House mix", isOverall: true },
    isOwn: false,
    trackerCount: 0,
  },
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
  row(intention("house", { targetPages: null, isOverall: true, tracksMixOf: null }), {
    mix: {
      id: "d1",
      name: "House mix",
      revision: 4,
      owner: { id: "house", name: "House mix", isOverall: true },
      isOwn: true,
      trackerCount: 3,
    },
  }),
];

describe("columnSectionsOf", () => {
  it("runs dated targets by their end, then open-ended ones by how far along they are", () => {
    const targets = columnSectionsOf(rows, "target");

    expect(targets.running.map((value) => value.intention.id)).toEqual([
      "soon",
      "late",
      "open-far",
      "open-near",
    ]);
    expect(targets.upcoming.map((value) => value.intention.id)).toEqual(["next"]);
    expect(targets.ended.map((value) => value.intention.id)).toEqual(["may"]);
    expect(targets.archived.map((value) => value.intention.id)).toEqual(["gone"]);
  });

  it("shows every intention in Output, with Overall first", () => {
    expect(columnSectionsOf(rows, "track").running.map((value) => value.intention.id)).toEqual([
      "house",
      "late",
      "open-far",
      "open-near",
      "soon",
      "watch",
    ]);
  });
});

describe("tileOf", () => {
  it("counts intentions and their verdicts, never pages", () => {
    const parts = (column: "target" | "track") =>
      tileOf(columnSectionsOf(rows, column), column).map((part) => `${part.count} ${part.label}`);

    expect(parts("target")).toEqual(["4 running", "1 upcoming", "1 on pace", "1 behind pace"]);
    expect(parts("track")).toEqual([
      "6 running",
      "1 upcoming",
      "1 behind pace",
      "1 on pace",
      "1 out of band",
    ]);
  });
});

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

describe("intentionsUrlStateOf", () => {
  it("shows the column of the focused card, else the one asked for", () => {
    expect(intentionsUrlStateOf(new URLSearchParams("i=watch"), rows)).toMatchObject({
      focusedId: "watch",
      column: "track",
    });
    expect(intentionsUrlStateOf(new URLSearchParams("col=track"), rows).column).toBe("track");
    expect(intentionsUrlStateOf(new URLSearchParams("i=nobody"), rows)).toMatchObject({
      focusedId: null,
      column: "target",
    });
  });
});
