// A project's period and pace, worked out from its dates and what it delivered.

import { describe, expect, it } from "vitest";
import type { PaceInput } from "@/domain/projects";
import { daysUntil, evenPaceOf, paceVerdictOf, periodOf, timeElapsedOf } from "@/domain/projects";

const year = { startsOn: "2026-01-01", endsOn: "2026-12-31" };

describe("periodOf", () => {
  it("counts the first and the last day as part of the period", () => {
    expect(periodOf(year, "2025-12-31")).toBe("Upcoming");
    expect(periodOf(year, "2026-01-01")).toBe("Active");
    expect(periodOf(year, "2026-12-31")).toBe("Active");
    expect(periodOf(year, "2027-01-01")).toBe("Ended");
  });
});

describe("timeElapsedOf", () => {
  it("is the share of the days gone, kept between 0 and 1", () => {
    expect(timeElapsedOf(year, "2026-01-01")).toBe(0);
    expect(timeElapsedOf(year, "2026-07-02")).toBeCloseTo(182 / 365);
    expect(timeElapsedOf(year, "2028-01-01")).toBe(1);
  });
});

describe("daysUntil", () => {
  it("counts whole days, negative once past", () => {
    expect(daysUntil("2026-07-02", "2026-06-25")).toBe(7);
    expect(daysUntil("2026-06-20", "2026-06-25")).toBe(-5);
  });
});

describe("paceVerdictOf", () => {
  const input = (patch: Partial<PaceInput>): PaceInput => ({
    project: { ...year, state: "Approved", targetPages: 1000 },
    fundedCount: 3,
    deliveredPages: 400,
    today: "2026-07-02",
    ...patch,
  });

  it("reads on pace within ten points of the time gone, behind beyond them", () => {
    expect(paceVerdictOf(input({ deliveredPages: 400 }))).toBe("onPace");
    expect(paceVerdictOf(input({ deliveredPages: 390 }))).toBe("behindPace");
  });

  it("says met or short once ended", () => {
    expect(paceVerdictOf(input({ today: "2027-02-01", deliveredPages: 1000 }))).toBe("targetMet");
    expect(paceVerdictOf(input({ today: "2027-02-01", deliveredPages: 999 }))).toBe("short");
  });

  it("has none before it starts, with nothing funded, or before approval", () => {
    expect(paceVerdictOf(input({ today: "2025-06-01" }))).toBeNull();
    expect(paceVerdictOf(input({ fundedCount: 0 }))).toBeNull();
    expect(
      paceVerdictOf(input({ project: { ...year, state: "Proposed", targetPages: 1000 } })),
    ).toBeNull();
  });
});

describe("evenPaceOf", () => {
  it("marks the even pace only while an approved project runs", () => {
    expect(evenPaceOf({ ...year, state: "Approved" }, "2026-07-02")).toBeCloseTo(182 / 365);
    expect(evenPaceOf({ ...year, state: "Proposed" }, "2026-07-02")).toBeNull();
    expect(evenPaceOf({ ...year, state: "Approved" }, "2027-07-02")).toBeNull();
  });
});
