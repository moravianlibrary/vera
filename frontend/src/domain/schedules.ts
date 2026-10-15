// When something runs by itself (page-composition.md §5 *Tasks*; STATUS "Tasks"): a cadence, what
// a run does when the previous one is still going, and the moments a cadence falls on. The server
// and the editor's preview read the same rule, so the next runs a draft shows are the ones it
// will get. Times are the library's own clock, as a person reads them on the wall.

import { z } from "zod";
import type { RepeatEvery } from "@/domain/entities";

// "02:00".
export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "A time such as 02:00");

// Every 5 minutes is the shortest: anything that has to react faster is an event, and events are
// Hooks (STATUS "Tasks").
export const shortestIntervalMinutes = 5;

// Sunday is 0, as a JavaScript date counts. A month's day stops at 28, so every month has it.
export const cadenceSchema = z.discriminatedUnion("every", [
  z.object({ every: z.literal("minutes"), interval: z.number().int().positive() }),
  z.object({ every: z.literal("hours"), interval: z.number().int().positive() }),
  z.object({ every: z.literal("day"), at: clockTimeSchema }),
  z.object({
    every: z.literal("week"),
    weekday: z.number().int().min(0).max(6),
    at: clockTimeSchema,
  }),
  z.object({
    every: z.literal("month"),
    day: z.number().int().min(1).max(28),
    at: clockTimeSchema,
  }),
  // An intention repeat's only; a plugin schedule is never quarterly.
  z.object({ every: z.literal("quarter"), at: clockTimeSchema }),
]);
export type Cadence = z.infer<typeof cadenceSchema>;
export type CadenceKind = Cadence["every"];

// What the schedule editor offers (STATUS "Tasks": every N min, every N hours, daily, weekly,
// monthly).
export const editableCadenceKinds = ["minutes", "hours", "day", "week", "month"] as const;
export type EditableCadenceKind = (typeof editableCadenceKinds)[number];

// When a run is due while the previous one is still going: skip it, so the next one catches up,
// or wait and run after it, so none is missed.
export const overlaps = ["skip", "wait"] as const;
export const overlapSchema = z.enum(overlaps);
export type Overlap = z.infer<typeof overlapSchema>;

// The plugin kinds that can run by themselves (plugins.md §2.4, ON_SCHEDULE); an input, a list
// generator or a link runs only while somebody uses it.
export const schedulableKinds = [
  "CatalogAdapter",
  "Registry",
  "Harvester",
  "PropertySource",
  "Validation",
  "Restriction",
  "PublicationDetector",
] as const;

// An intention repeat makes the next occurrence as its period starts: Monday, the 1st, or the
// first day of a quarter, at midnight (intentions.md §3.3).
export function repeatCadenceOf(every: RepeatEvery): Cadence {
  switch (every) {
    case "week":
      return { every: "week", weekday: 1, at: "00:00" };
    case "month":
      return { every: "month", day: 1, at: "00:00" };
    case "quarter":
      return { every: "quarter", at: "00:00" };
  }
}

const minuteMilliseconds = 60_000;
const dayMilliseconds = 24 * 60 * minuteMilliseconds;
// Enough for the month a timeline shows of the shortest interval; a caller asks for less.
const occurrenceCeiling = 10_000;

// Every moment the cadence falls on in [from, to), in order, at most `limit` of them. An interval
// counts from midnight, so "every 15 min" is :00, :15, :30, :45 whatever started it.
export function occurrencesOf(
  cadence: Cadence,
  from: Date,
  to: Date,
  limit = occurrenceCeiling,
): Date[] {
  const found: Date[] = [];
  for (
    let day = startOfDay(from);
    day.getTime() < to.getTime() && found.length < limit;
    day = nextDay(day)
  ) {
    for (const moment of momentsOn(cadence, day)) {
      if (found.length >= limit) {
        break;
      }

      if (moment.getTime() >= from.getTime() && moment.getTime() < to.getTime()) {
        found.push(moment);
      }
    }
  }

  return found;
}

// The first moment after `after`, looked for over the next 100 days.
export function nextOccurrenceOf(cadence: Cadence, after: Date): Date | null {
  const from = new Date(after.getTime() + 1);
  const [next] = occurrencesOf(cadence, from, new Date(from.getTime() + 100 * dayMilliseconds), 1);
  return next ?? null;
}

export function isTooFrequent(cadence: Cadence): boolean {
  return cadence.every === "minutes" && cadence.interval < shortestIntervalMinutes;
}

function momentsOn(cadence: Cadence, day: Date): Date[] {
  if (cadence.every === "minutes" || cadence.every === "hours") {
    const stepMinutes = cadence.every === "hours" ? cadence.interval * 60 : cadence.interval;
    const moments: Date[] = [];
    for (let minute = 0; minute < 24 * 60; minute += stepMinutes) {
      moments.push(atMinute(day, minute));
    }

    return moments;
  }

  const isDue =
    cadence.every === "day" ||
    (cadence.every === "week" && day.getDay() === cadence.weekday) ||
    (cadence.every === "month" && day.getDate() === cadence.day) ||
    (cadence.every === "quarter" && day.getDate() === 1 && day.getMonth() % 3 === 0);
  if (!isDue) {
    return [];
  }

  const [hours = 0, minutes = 0] = cadence.at.split(":").map(Number);
  return [atMinute(day, hours * 60 + minutes)];
}

function startOfDay(moment: Date): Date {
  return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate());
}

function nextDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
}

function atMinute(day: Date, minute: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minute);
}
