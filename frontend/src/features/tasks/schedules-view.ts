// The Schedules view's state and its editor's form (docs/demos/shared/page-tasks.js
// `scheduleView`, `editSchedule`): the timeline's window in `?range=` (the day by default) and
// the schedule a link points at in `?s=`; the editor's fields, every one a cadence could need,
// read into the one cadence the chosen Repeat keeps, and back.

import type { TimelineRange } from "@vera/contract/schedules";
import { timelineRanges } from "@vera/contract/schedules";
import type { Cadence, EditableCadenceKind } from "@vera/domain/schedules";
import {
  clockTimeSchema,
  editableCadenceKinds,
  overlapSchema,
  shortestIntervalMinutes,
} from "@vera/domain/schedules";
import { z } from "zod";

export const rangeParam = "range";
export const focusedScheduleParam = "s";

export const rangeLabels = {
  day: "tasks:schedulesView.day",
  week: "tasks:schedulesView.week",
  month: "tasks:schedulesView.month",
} as const satisfies Record<TimelineRange, string>;

export const rangeTitles = {
  day: "tasks:schedulesView.next24Hours",
  week: "tasks:schedulesView.next7Days",
  month: "tasks:schedulesView.next30Days",
} as const satisfies Record<TimelineRange, string>;

// An unknown range reads as the day, so a stale link still opens the view.
export function rangeOf(params: URLSearchParams): TimelineRange {
  return timelineRanges.find((range) => range === params.get(rangeParam)) ?? "day";
}

export const cadenceKindLabels = {
  minutes: "tasks:schedulesView.everyNMinutes",
  hours: "tasks:schedulesView.everyNHours",
  day: "tasks:schedulesView.daily",
  week: "tasks:schedulesView.weekly",
  month: "tasks:schedulesView.monthly",
} as const satisfies Record<EditableCadenceKind, string>;

export const scheduleFormSchema = z
  .object({
    instanceId: z.string().min(1, "scheduleDialogs.validationChoosePlugin"),
    names: z
      .object({ cs: z.string().optional(), en: z.string().optional() })
      .refine(
        (names) => !!names.cs?.trim() || !!names.en?.trim(),
        "scheduleDialogs.validationName",
      ),
    every: z.enum(editableCadenceKinds),
    interval: z
      .number({ error: "scheduleDialogs.validationNumber" })
      .int()
      .min(1, "scheduleDialogs.validationAtLeastOne"),
    weekday: z.number().int().min(0).max(6),
    day: z.number().int().min(1).max(28),
    at: clockTimeSchema,
    overlap: overlapSchema,
  })
  .refine((form) => form.every !== "minutes" || form.interval >= shortestIntervalMinutes, {
    path: ["interval"],
    message: "scheduleDialogs.validationMinimumInterval",
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
