// The counting rules on a small tree: what counts as planned, delivered and output, the pace
// against a target, and a mix read inside a scope.

import { describe, expect, it } from "vitest";
import type {
  Cancellation,
  Category,
  DigitizationList,
  Intention,
  Iteration,
} from "@/domain/entities";
import {
  catchUpPagesOf,
  countIntention,
  fillOf,
  intentionStateOf,
  isInWindow,
  mixOwnerOf,
  mixReadingOf,
  nextPeriodStartOf,
  pagesPerWeekNeededOf,
  shareWithinOf,
  targetVerdictOf,
  trackersOf,
} from "@/domain/intentions";

const categories: Category[] = [
  { id: "mono", name: "Monographs", parentId: null },
  { id: "per", name: "Periodicals", parentId: null },
  { id: "reg", name: "Regional", parentId: "per" },
  { id: "nat", name: "National", parentId: "per" },
  { id: "spec", name: "Specialist", parentId: "per" },
];

const shares = { mono: 40, per: 60, reg: 50, nat: 30 };

const list = (id: string, startsOn: string, endsOn: string): DigitizationList => ({
  id,
  name: id,
  startsOn,
  endsOn,
  targetPages: null,
  generated: null,
  createdBy: "u2",
  createdAt: "2026-01-01T09:00:00Z",
  done: null,
});

const lists = [list("june", "2026-06-01", "2026-06-19"), list("july", "2026-07-06", "2026-07-24")];

const iteration = (
  id: string,
  categoryId: string,
  overrides: Partial<Iteration> = {},
): Iteration => ({
  id,
  documentId: id,
  attempt: 1,
  requestId: id,
  categoryId,
  priority: "Normal",
  projectId: null,
  progress: "Planned",
  listId: null,
  formerListName: null,
  restriction: null,
  restrictionOverride: null,
  cancellation: null,
  defects: [],
  verdicts: [],
  ingestFailure: null,
  digitizedAt: null,
  publishedLink: null,
  scanDpi: null,
  ...overrides,
});

const cancellation: Cancellation = {
  cause: "Decided",
  actorId: "u2",
  at: "2026-06-10T09:00:00Z",
  publicText: "No longer needed.",
  internalText: null,
};

const iterations: Iteration[] = [
  // On the June list and scanned in it.
  iteration("a", "reg", {
    listId: "june",
    progress: "Digitized",
    digitizedAt: "2026-06-12T09:00:00Z",
    projectId: "p1",
  }),
  // On the June list, scanned, no date: the list's last day stands in.
  iteration("b", "nat", { listId: "june", progress: "Published" }),
  // On the June list, cancelled before it was scanned: stops counting.
  iteration("c", "mono", { listId: "june", cancellation }),
  // On the July list, not scanned yet.
  iteration("d", "mono", { listId: "july", progress: "InProgress" }),
  // Scanned in June off any list still standing: output, never planned.
  iteration("e", "spec", { progress: "Digitized", digitizedAt: "2026-06-02T09:00:00Z" }),
];

const pagesById: Record<string, number | null> = { a: 100, b: 200, c: 50, d: 400, e: 300 };
const data = {
  categories,
  lists,
  iterations,
  pagesOf: (it: Iteration) => pagesById[it.id] ?? null,
};

const intention = (overrides: Partial<Intention> = {}): Intention => ({
  id: "i",
  name: "June",
  description: "",
  funding: { kind: "any" },
  scopeCategoryId: null,
  tracksMixOf: null,
  distributionId: "d",
  targetPages: null,
  countsFrom: "2026-06-01",
  endsOn: "2026-06-30",
  isOverall: false,
  templateId: null,
  archived: null,
  ...overrides,
});

describe("isInWindow", () => {
  it("counts the first and the last day", () => {
    const june = intention();

    expect(isInWindow(june, "2026-06-01")).toBe(true);
    expect(isInWindow(june, "2026-06-30")).toBe(true);
    expect(isInWindow(june, "2026-07-01")).toBe(false);
    expect(isInWindow(intention({ endsOn: null }), "2030-01-01")).toBe(true);
  });
});

describe("intentionStateOf", () => {
  it("runs from the counting start to the end, and forever without one", () => {
    expect(intentionStateOf(intention(), "2026-05-31")).toBe("Upcoming");
    expect(intentionStateOf(intention(), "2026-06-30")).toBe("Running");
    expect(intentionStateOf(intention(), "2026-07-01")).toBe("Ended");
    expect(intentionStateOf(intention({ endsOn: null }), "2030-01-01")).toBe("Running");
  });
});

describe("countIntention", () => {
  it("plans what a list starting in the window carries, and delivers what was scanned in it", () => {
    const counted = countIntention(intention(), data);

    expect(counted.planned.map((it) => it.id)).toEqual(["a", "b"]);
    expect(counted.delivered.map((it) => it.id)).toEqual(["a", "b"]);
    expect(counted.output.map((it) => it.id)).toEqual(["a", "b", "e"]);
    expect([counted.plannedPages, counted.deliveredPages, counted.outputPages]).toEqual([
      300, 300, 600,
    ]);
  });

  it("matches funding and one category subtree", () => {
    const funded = countIntention(
      intention({ funding: { kind: "project", projectId: "p1" } }),
      data,
    );
    const unfunded = countIntention(intention({ funding: { kind: "none" } }), data);
    const periodicals = countIntention(intention({ scopeCategoryId: "per" }), data);

    expect(funded.output.map((it) => it.id)).toEqual(["a"]);
    expect(unfunded.output.map((it) => it.id)).toEqual(["b", "e"]);
    expect(periodicals.output.map((it) => it.id)).toEqual(["a", "b", "e"]);
  });

  it("drops the items of a deleted list from planned", () => {
    const counted = countIntention(intention({ endsOn: null }), { ...data, lists: [lists[1]] });

    expect(counted.planned.map((it) => it.id)).toEqual(["d"]);
  });

  it("says what has no date or no page count instead of dropping it silently", () => {
    const counted = countIntention(intention({ endsOn: null }), {
      ...data,
      lists: [],
      pagesOf: (it) => (it.id === "e" ? null : 1),
    });

    expect(counted.noDateCount).toBe(1);
    expect(counted.noPagesCount).toBe(1);
  });
});

describe("targetVerdictOf", () => {
  const target = (overrides: Partial<Intention>) => intention({ targetPages: 1000, ...overrides });

  it("reads pace with ten points of slack while a dated target runs", () => {
    const today = "2026-06-16";

    expect(
      targetVerdictOf({ intention: target({}), plannedPages: 0, deliveredPages: 400, today }),
    ).toBe("onPace");
    expect(
      targetVerdictOf({ intention: target({}), plannedPages: 0, deliveredPages: 300, today }),
    ).toBe("behindPace");
  });

  it("has no pace without an end, only fully planned or met", () => {
    const open = target({ endsOn: null });
    const today = "2026-06-16";

    expect(
      targetVerdictOf({ intention: open, plannedPages: 500, deliveredPages: 0, today }),
    ).toBeNull();
    expect(targetVerdictOf({ intention: open, plannedPages: 1000, deliveredPages: 0, today })).toBe(
      "fullyPlanned",
    );
    expect(targetVerdictOf({ intention: open, plannedPages: 0, deliveredPages: 1000, today })).toBe(
      "targetMet",
    );
  });

  it("is met or short once ended, and fully planned at most before it starts", () => {
    expect(
      targetVerdictOf({
        intention: target({}),
        plannedPages: 0,
        deliveredPages: 999,
        today: "2026-07-01",
      }),
    ).toBe("short");
    expect(
      targetVerdictOf({
        intention: target({}),
        plannedPages: 1000,
        deliveredPages: 0,
        today: "2026-05-01",
      }),
    ).toBe("fullyPlanned");
    expect(
      targetVerdictOf({
        intention: intention(),
        plannedPages: 0,
        deliveredPages: 0,
        today: "2026-06-16",
      }),
    ).toBeNull();
  });
});

describe("pages to catch up", () => {
  it("needs the rest spread over the weeks left, and plans up to an even pace", () => {
    const behind = {
      intention: intention({ targetPages: 1000 }),
      plannedPages: 100,
      deliveredPages: 100,
      today: "2026-06-16",
    };

    // 15 days left, so 900 pp over 15/7 weeks.
    expect(pagesPerWeekNeededOf(behind)).toBe(420);
    // Half the window gone: 500 pp at an even pace, 100 on lists.
    expect(catchUpPagesOf(behind)).toBe(400);
    expect(catchUpPagesOf({ ...behind, deliveredPages: 500 })).toBeNull();
  });
});

describe("the mix", () => {
  it("reads a share from the scope down, the scope being 100%", () => {
    expect(shareWithinOf(categories, { shares }, null, "reg")).toBeCloseTo(30);
    expect(shareWithinOf(categories, { shares }, "per", "reg")).toBeCloseTo(50);
    expect(shareWithinOf(categories, { shares }, "per", "spec")).toBeNull();
    expect(shareWithinOf(categories, { shares }, "per", "mono")).toBeNull();
  });

  it("compares the output with the intended shares within a band of five points", () => {
    const periodicals = intention({ scopeCategoryId: "per" });
    const counted = countIntention(periodicals, data);
    const reading = mixReadingOf(periodicals, { shares }, counted, data);

    expect(reading.rows.map((row) => [row.categoryId, row.flag])).toEqual([
      ["reg", "under"],
      ["nat", "inBand"],
      ["spec", "noShare"],
    ]);
    expect(reading.unallocated).toBe(20);
    expect(reading.outOfBandCount).toBe(1);
  });

  it("flags output in a category at 0%", () => {
    const counted = countIntention(intention(), data);
    const reading = mixReadingOf(intention(), { shares: { mono: 0, per: 100 } }, counted, data);

    expect(reading.rows.find((row) => row.categoryId === "mono")?.flag).toBe("inBand");
    expect(
      mixReadingOf(intention(), { shares: { mono: 100, per: 0 } }, counted, data).rows.find(
        (row) => row.categoryId === "per",
      )?.flag,
    ).toBe("excludedUsed");
  });

  it("splits a target across the leaves of its scope", () => {
    const periodicals = intention({ scopeCategoryId: "per", targetPages: 1000 });
    const counted = countIntention(periodicals, data);

    expect(
      fillOf(periodicals, { shares }, counted, data).map((row) => [
        row.categoryId,
        row.targetPages,
        row.plannedPages,
        row.isShort,
      ]),
    ).toEqual([
      ["reg", 500, 100, true],
      ["nat", 300, 200, true],
      ["spec", null, 0, false],
    ]);
  });

  it("is the tracked owner's, one step away", () => {
    const owner = intention({ id: "owner" });
    const tracker = intention({ id: "tracker", tracksMixOf: "owner" });

    expect(mixOwnerOf(tracker, [owner, tracker])).toBe(owner);
    expect(mixOwnerOf(owner, [owner, tracker])).toBe(owner);
    expect(trackersOf(owner, [owner, tracker])).toEqual([tracker]);
  });
});

describe("nextPeriodStartOf", () => {
  it("starts the next week on a Monday, a month and a quarter on their first day", () => {
    expect(nextPeriodStartOf("week", "2026-06-25")).toBe("2026-06-29");
    expect(nextPeriodStartOf("week", "2026-06-29")).toBe("2026-07-06");
    expect(nextPeriodStartOf("month", "2026-12-15")).toBe("2027-01-01");
    expect(nextPeriodStartOf("quarter", "2026-06-25")).toBe("2026-07-01");
    expect(nextPeriodStartOf("quarter", "2026-07-01")).toBe("2026-10-01");
  });
});
