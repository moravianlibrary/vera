// A project's period, worked out from its dates; its pace is its intention's.

import { describe, expect, it } from "bun:test";
import { daysUntil, periodOf, timeElapsedOf } from "./projects";

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
