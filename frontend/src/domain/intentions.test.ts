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
  correctionOf,
  countIntention,
  countsTowardsOf,
  fillOf,
  intentionStateOf,
  isInWindow,
  listMixOf,
  mixReadingOf,
  nextPeriodStartOf,
  pagesPerWeekNeededOf,
  shareWithinOf,
  targetVerdictOf,
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
  // On the June list, marked Done on its last day.
  iteration("b", "nat", {
    listId: "june",
    progress: "Published",
    digitizedAt: "2026-06-30T16:00:00Z",
  }),
  // On the June list, cancelled before it was scanned: stops counting.
  iteration("c", "mono", { listId: "june", cancellation }),
  // On the July list, not scanned yet.
  iteration("d", "mono", { listId: "july", progress: "InProgress" }),
  // Scanned in June off any list still standing: output, never planned.
  iteration("e", "spec", { progress: "Digitized", digitizedAt: "2026-06-02T09:00:00Z" }),
];

// The same, with the June list past its end and not marked Done: b has no day it was digitized.
const undated = iterations.map((it) => (it.id === "b" ? { ...it, digitizedAt: null } : it));

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
  projectId: null,
  scopeCategoryId: null,
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

  it("PLAN-digitized-date: delivers nothing from a list past its end until it is marked Done", () => {
    const counted = countIntention(intention({ endsOn: null }), { ...data, iterations: undated });

    expect(counted.planned.map((it) => it.id)).toContain("b");
    expect(counted.delivered.map((it) => it.id)).toEqual(["a"]);
    expect(counted.noDateCount).toBe(1);
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
      iterations: undated,
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

describe("correctionOf", () => {
  const rows = [
    { categoryId: "mono", intended: 40, outputPages: 100 },
    { categoryId: "per", intended: 60, outputPages: 400 },
    { categoryId: "maps", intended: null, outputPages: 0 },
  ];
  const ready: Record<string, number> = { mono: 100, per: 1000 };
  const correct = (pages: number) =>
    correctionOf({
      rows,
      outputPages: 500,
      pages,
      readyPagesOf: (categoryId) => ready[categoryId] ?? 0,
    });

  it("gives each category what it lacks against its share of output and new pages", () => {
    const { rows: plan, isCut } = correct(500);

    expect(isCut).toBe(false);
    expect(plan.map((row) => [row.categoryId, row.newPages, row.after])).toEqual([
      ["mono", 300, 40],
      ["per", 200, 60],
      ["maps", 0, 0],
    ]);
    expect(plan[0]?.shortPages).toBe(200);
  });

  it("cuts the gaps in proportion when they add up to more than the pages", () => {
    const { rows: plan, isCut } = correct(100);

    expect(isCut).toBe(true);
    expect(plan.map((row) => row.newPages)).toEqual([100, 0, 0]);
  });

  it("spreads pages left over by the shares, when part of the mix is unallocated", () => {
    const partial = correctionOf({
      rows: [
        { categoryId: "mono", intended: 40, outputPages: 100 },
        { categoryId: "per", intended: 50, outputPages: 400 },
      ],
      outputPages: 500,
      pages: 500,
      readyPagesOf: () => 1000,
    });

    expect(partial.rows.map((row) => row.newPages)).toEqual([340, 160]);
  });
});

describe("countsTowardsOf", () => {
  const members = [iterations[0], iterations[3]].filter((it) => it !== undefined);

  it("counts the members each intention's scope matches, when its window holds the start", () => {
    const funded = intention({ id: "p", funding: { kind: "project", projectId: "p1" } });
    const archived = intention({
      id: "x",
      archived: { actor: { kind: "system" }, at: "2026-06-30T00:00:00Z" },
    });
    const counted = countsTowardsOf([intention(), funded, archived], members, "2026-06-05", data);

    expect(counted.map((row) => [row.intention.id, row.itemCount, row.pages])).toEqual([
      ["i", 2, 500],
      ["p", 1, 100],
    ]);
    expect(countsTowardsOf([intention()], members, "2026-07-06", data)).toEqual([]);
  });
});

describe("listMixOf", () => {
  const members = [iterations[0], iterations[1]].filter((it) => it !== undefined);

  it("reads the fill within the scope against the target, or against an allocation", () => {
    const scoped = { scopeCategoryId: "per" };
    const byTarget = listMixOf(
      scoped,
      { shares },
      members,
      { targetPages: 1000, allocation: null },
      data,
    );
    const byAllocation = listMixOf(
      scoped,
      { shares },
      members,
      { targetPages: 1000, allocation: { reg: 70 } },
      data,
    );

    expect(byTarget).toEqual([
      { categoryId: "reg", share: 50, pages: 100, goalPages: 500 },
      { categoryId: "nat", share: 30, pages: 200, goalPages: 300 },
      { categoryId: "spec", share: null, pages: 0, goalPages: null },
    ]);
    expect(byAllocation.map((row) => row.goalPages)).toEqual([70, 0, 0]);
  });

  it("reads a leaf scope as itself, all of it", () => {
    expect(
      listMixOf(
        { scopeCategoryId: "reg" },
        { shares },
        members,
        { targetPages: null, allocation: null },
        data,
      ),
    ).toEqual([{ categoryId: "reg", share: 100, pages: 100, goalPages: 100 }]);
  });
});
