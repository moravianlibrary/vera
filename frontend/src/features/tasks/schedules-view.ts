// The Schedules view's state and its editor's form (docs/demos/shared/page-tasks.js
// `scheduleView`, `editSchedule`): the timeline's window in `?range=` (the day by default) and
// the schedule a link points at in `?s=`; the editor's fields, every one a cadence could need,
// read into the one cadence the chosen Repeat keeps, and back.
// TODO(rrandiak): labels move to i18n.

import { z } from "zod";
import type { TimelineRange } from "@/api/schedules";
import { timelineRanges } from "@/api/schedules";
import type { Cadence, EditableCadenceKind } from "@/domain/schedules";
import {
  clockTimeSchema,
  editableCadenceKinds,
  overlapSchema,
  shortestIntervalMinutes,
} from "@/domain/schedules";

export const rangeParam = "range";
export const focusedScheduleParam = "s";

export const rangeLabels = {
  day: "24 h",
  week: "7 days",
  month: "Month",
} as const satisfies Record<TimelineRange, string>;

export const rangeTitles = {
  day: "Next 24 hours",
  week: "Next 7 days",
  month: "Next 30 days",
} as const satisfies Record<TimelineRange, string>;

// An unknown range reads as the day, so a stale link still opens the view.
export function rangeOf(params: URLSearchParams): TimelineRange {
  return timelineRanges.find((range) => range === params.get(rangeParam)) ?? "day";
}

export const cadenceKindLabels = {
  minutes: "Every N minutes",
  hours: "Every N hours",
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
} as const satisfies Record<EditableCadenceKind, string>;

export const scheduleFormSchema = z
  .object({
    instanceId: z.string().min(1, "Choose the plugin it runs."),
    name: z.string().trim().min(1, "Give it a name: it is what a run is listed under."),
    every: z.enum(editableCadenceKinds),
    interval: z.number({ error: "A whole number" }).int().min(1, "At least 1"),
    weekday: z.number().int().min(0).max(6),
    day: z.number().int().min(1).max(28),
    at: clockTimeSchema,
    overlap: overlapSchema,
  })
  .refine((form) => form.every !== "minutes" || form.interval >= shortestIntervalMinutes, {
    path: ["interval"],
    message: "Every 5 minutes is the shortest: anything faster is an event, and events are Hooks.",
  });
export type ScheduleForm = z.infer<typeof scheduleFormSchema>;

export function cadenceOfForm(form: ScheduleForm): Cadence {
  switch (form.every) {
    case "minutes":
    case "hours":
      return { every: form.every, interval: form.interval };
    case "day":
      return { every: "day", at: form.at };
    case "week":
      return { every: "week", weekday: form.weekday, at: form.at };
    case "month":
      return { every: "month", day: form.day, at: form.at };
  }
}

// What the editor opens with: the cadence's own values, and the rest at their defaults.
export function formOfCadence(
  cadence: Cadence,
): Pick<ScheduleForm, "every" | "interval" | "weekday" | "day" | "at"> {
  const defaults = { every: "day" as const, interval: 15, weekday: 1, day: 1, at: "02:00" };
  switch (cadence.every) {
    case "minutes":
    case "hours":
      return { ...defaults, every: cadence.every, interval: cadence.interval };
    case "day":
      return { ...defaults, at: cadence.at };
    case "week":
      return { ...defaults, every: "week", weekday: cadence.weekday, at: cadence.at };
    case "month":
      return { ...defaults, every: "month", day: cadence.day, at: cadence.at };
    case "quarter":
      return { ...defaults, every: "month", at: cadence.at };
  }
}
