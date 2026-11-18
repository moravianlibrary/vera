// The schedule editor's fields read into one cadence and back, and its shortest interval.

import { describe, expect, it } from "vitest";
import {
  cadenceOfForm,
  formOfCadence,
  rangeOf,
  scheduleFormSchema,
} from "@/features/tasks/schedules-view";

const form = {
  instanceId: "pi5",
  names: { en: "RDCZ — nightly check" },
  every: "day" as const,
  interval: 15,
  weekday: 1,
  day: 1,
  at: "03:30",
  overlap: "skip" as const,
};

describe("cadenceOfForm and formOfCadence", () => {
  it("keeps only what the chosen Repeat needs", () => {
    expect(cadenceOfForm({ ...form, every: "week", weekday: 0 })).toEqual({
      every: "week",
      weekday: 0,
      at: "03:30",
    });
    expect(cadenceOfForm({ ...form, every: "minutes", interval: 30 })).toEqual({
      every: "minutes",
      interval: 30,
    });
  });

  it("reads a cadence back into the fields", () => {
    const cadence = { every: "month" as const, day: 12, at: "04:00" };

    expect(cadenceOfForm({ ...form, ...formOfCadence(cadence) })).toEqual(cadence);
  });
});

describe("scheduleFormSchema", () => {
  it("accepts a schedule named only in the other language", () => {
    expect(scheduleFormSchema.safeParse({ ...form, names: { cs: "Kontrola" } }).success).toBe(true);
  });
  it("refuses an interval under 5 minutes, and only in minutes", () => {
    expect(scheduleFormSchema.safeParse({ ...form, every: "minutes", interval: 4 }).success).toBe(
      false,
    );
    expect(scheduleFormSchema.safeParse({ ...form, every: "hours", interval: 4 }).success).toBe(
      true,
    );
  });
});

describe("rangeOf", () => {
  it("reads the day when the URL names no range it knows", () => {
    expect(rangeOf(new URLSearchParams("range=week"))).toBe("week");
    expect(rangeOf(new URLSearchParams("range=year"))).toBe("day");
  });
});
