// How Tasks reads a moment against the server's, and how it names a cadence.

import { describe, expect, it } from "vitest";
import { durationText, timeLeftText } from "@/features/tasks/task-words";
import { cadenceText } from "@/lib/format-cadence";
import { agoText, aheadText } from "@/lib/format-moment";

const at = (day: number, hours: number, minutes: number) =>
  new Date(2026, 5, day, hours, minutes).toISOString();
const asOf = at(25, 10, 40);

describe("agoText", () => {
  it("counts minutes within the hour, then names the day", () => {
    expect(agoText(at(25, 10, 40), asOf)).toBe("just now");
    expect(agoText(at(25, 10, 38), asOf)).toBe("2 min ago");
    expect(agoText(at(25, 6, 0), asOf)).toBe("today 06:00");
    expect(agoText(at(24, 14, 5), asOf)).toBe("yesterday 14:05");
    expect(agoText(at(22, 14, 5), asOf)).toBe("22 Jun 14:05");
  });
});

describe("aheadText", () => {
  it("counts minutes within the hour, then names the day", () => {
    expect(aheadText(at(25, 10, 45), asOf)).toBe("in 5 min");
    expect(aheadText(at(25, 18, 0), asOf)).toBe("today 18:00");
    expect(aheadText(at(26, 2, 0), asOf)).toBe("tomorrow 02:00");
    expect(aheadText(at(29, 6, 0), asOf)).toBe("Mon 29 Jun 06:00");
  });
});

describe("durationText and timeLeftText", () => {
  it("say seconds, minutes or hours", () => {
    expect(durationText(38_000)).toBe("38 s");
    expect(durationText(252_000)).toBe("4 min 12 s");
    expect(durationText(3_900_000)).toBe("1 h 5 min");
    expect(timeLeftText(30)).toBe("under a minute left");
    expect(timeLeftText(125)).toBe("about 2 min left");
  });
});

describe("cadenceText", () => {
  it("names every cadence", () => {
    expect(cadenceText({ every: "minutes", interval: 15 })).toBe("every 15 min");
    expect(cadenceText({ every: "hours", interval: 1 })).toBe("hourly");
    expect(cadenceText({ every: "week", weekday: 1, at: "06:00" })).toBe("weekly, Mon 06:00");
    expect(cadenceText({ every: "month", day: 1, at: "00:00" })).toBe("monthly, day 1 at 00:00");
  });
});
