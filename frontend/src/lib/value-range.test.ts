// The range a filter writes into the URL and reads back from it.

import { describe, expect, it } from "vitest";
import {
  formatRange,
  isReversedRange,
  isWithinRange,
  lastDaysRange,
  monthRange,
  parseCount,
  parseDay,
  parseRange,
} from "@/lib/value-range";

describe("a range in the URL", () => {
  it("round-trips with either end open", () => {
    expect(formatRange({ from: 1000 })).toBe("1000..");
    expect(formatRange({ to: 200 })).toBe("..200");
    expect(parseRange("200..1000", parseCount)).toEqual({ from: 200, to: 1000 });
    expect(parseRange("..2026-06-30", parseDay)).toEqual({ to: "2026-06-30" });
  });

  it("writes nothing for a range with no end", () => {
    expect(formatRange({})).toBeNull();
    expect(parseRange("..", parseCount)).toBeUndefined();
  });

  it("drops what it cannot read rather than guessing", () => {
    expect(parseRange("1000", parseCount)).toBeUndefined(); // no separator
    expect(parseRange("ten..20", parseCount)).toBeUndefined();
    expect(parseRange("2026-02-30..", parseDay)).toBeUndefined(); // not a day
    expect(parseRange("1..2..3", parseCount)).toBeUndefined();
  });
});

describe("isWithinRange", () => {
  it("includes both ends", () => {
    expect(isWithinRange(200, { from: 200, to: 1000 })).toBe(true);
    expect(isWithinRange(1000, { from: 200, to: 1000 })).toBe(true);
    expect(isWithinRange(1001, { from: 200, to: 1000 })).toBe(false);
    expect(isWithinRange("2026-06-01", { from: "2026-06-01" })).toBe(true);
  });
});

describe("day ranges", () => {
  const today = new Date(2026, 5, 25);

  it("counts today among the last days", () => {
    expect(lastDaysRange(today, 7)).toEqual({ from: "2026-06-19", to: "2026-06-25" });
  });

  it("spans the whole month, across a month's end", () => {
    expect(monthRange(today)).toEqual({ from: "2026-06-01", to: "2026-06-30" });
    expect(lastDaysRange(new Date(2026, 6, 2), 7)).toEqual({
      from: "2026-06-26",
      to: "2026-07-02",
    });
  });

  it("says when the ends are the wrong way round", () => {
    expect(isReversedRange({ from: 1000, to: 200 })).toBe(true);
    expect(isReversedRange({ from: "2026-06-01" })).toBe(false);
  });
});
