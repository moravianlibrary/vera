// The moments a cadence falls on, which the server lists and the editor previews alike.

import { describe, expect, it } from "bun:test";
import { isTooFrequent, nextOccurrenceOf, occurrencesOf, repeatCadenceOf } from "./schedules";

// 2026-06-25 is a Thursday.
const thursday = (hours: number, minutes: number) => new Date(2026, 5, 25, hours, minutes);

describe("occurrencesOf", () => {
  it("counts an interval from midnight, whatever the moment asked from", () => {
    const moments = occurrencesOf(
      { every: "minutes", interval: 15 },
      thursday(10, 40),
      thursday(11, 20),
    );

    expect(moments).toEqual([thursday(10, 45), thursday(11, 0), thursday(11, 15)]);
  });

  it("restarts an interval at midnight when it does not divide the day", () => {
    const moments = occurrencesOf(
      { every: "hours", interval: 7 },
      thursday(20, 0),
      new Date(2026, 5, 26, 8, 0),
    );

    expect(moments).toEqual([
      thursday(21, 0),
      new Date(2026, 5, 26, 0, 0),
      new Date(2026, 5, 26, 7, 0),
    ]);
  });

  it("finds a weekday, a day of the month and a quarter's first day", () => {
    const from = thursday(10, 40);
    const to = new Date(2026, 9, 2);

    expect(occurrencesOf({ every: "week", weekday: 1, at: "06:00" }, from, to)[0]).toEqual(
      new Date(2026, 5, 29, 6, 0),
    );
    expect(occurrencesOf({ every: "month", day: 1, at: "00:00" }, from, to)).toHaveLength(4);
    expect(occurrencesOf({ every: "quarter", at: "00:00" }, from, to)).toEqual([
      new Date(2026, 6, 1),
      new Date(2026, 9, 1),
    ]);
  });

  it("stops at the limit asked for", () => {
    const moments = occurrencesOf(
      { every: "minutes", interval: 5 },
      thursday(0, 0),
      new Date(2026, 6, 25),
      61,
    );

    expect(moments).toHaveLength(61);
  });
});

describe("nextOccurrenceOf", () => {
  it("is strictly after the moment", () => {
    expect(nextOccurrenceOf({ every: "day", at: "10:40" }, thursday(10, 40))).toEqual(
      new Date(2026, 5, 26, 10, 40),
    );
  });
});

describe("isTooFrequent", () => {
  it("refuses an interval under 5 minutes", () => {
    expect(isTooFrequent({ every: "minutes", interval: 4 })).toBe(true);
    expect(isTooFrequent({ every: "minutes", interval: 5 })).toBe(false);
    expect(isTooFrequent({ every: "hours", interval: 1 })).toBe(false);
  });
});

describe("repeatCadenceOf", () => {
  it("falls on the start of the period, at midnight", () => {
    expect(repeatCadenceOf("week")).toEqual({ every: "week", weekday: 1, at: "00:00" });
    expect(repeatCadenceOf("month")).toEqual({ every: "month", day: 1, at: "00:00" });
  });
});
