// The Schedules resource (page-composition.md §5 *Tasks*; STATUS "Tasks"): what runs by itself and
// when, for `task.read`. A plugin schedule is made, edited, paused and deleted only here
// (`task.schedule`); an intention repeat is listed beside them so everything that happens by
// itself is in one place, and is edited on Intentions. Each row carries its last run, its next,
// and the runs it makes over the timeline's window, worked out by the server.

import { z } from "zod";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";
import { apiRoutes, scheduleActionRoute, scheduleRoute } from "@/api/routes";
import type { Run } from "@/api/tasks";
import { runSchema } from "@/api/tasks";
import { pluginInstanceSchema } from "@/domain/plugins";
import { cadenceSchema, overlapSchema } from "@/domain/schedules";

const id = z.string().min(1);
const timestamp = z.iso.datetime();
const count = z.number().int().nonnegative();

// The timeline's window, from now: a day, a week, or a month (the user asked for the month).
export const timelineRanges = ["day", "week", "month"] as const;
export const timelineRangeSchema = z.enum(timelineRanges);
export type TimelineRange = z.infer<typeof timelineRangeSchema>;

// More runs than this in the window are counted, not listed: the timeline draws them as a band.
export const listedRunCeiling = 60;

export const schedulePauseSchema = z.object({
  pausedBy: id,
  pausedAt: timestamp,
  // Shown on the row, so nobody resumes it too early.
  reason: z.string(),
});
export type SchedulePause = z.infer<typeof schedulePauseSchema>;

export const scheduleRowSchema = z.object({
  id,
  name: z.string(),
  // A plugin schedule runs an instance; a repeat makes an intention's next occurrence.
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("plugin"), instance: pluginInstanceSchema }),
    z.object({ kind: z.literal("repeat"), templateId: id }),
  ]),
  cadence: cadenceSchema,
  overlap: overlapSchema,
  pause: schedulePauseSchema.nullable(),
  createdBy: id,
  since: z.iso.date(),
  lastRun: runSchema.pick({ id: true, state: true, startedAt: true, errorCount: true }).nullable(),
  // None while paused.
  nextAt: timestamp.nullable(),
  // Runs of it on record, which outlive it under retention.
  runCount: count,
  // Over the window asked for: how many, and when, unless there are more than the ceiling.
  window: z.object({ runCount: count, runsAt: z.array(timestamp) }),
});
export type ScheduleRow = z.infer<typeof scheduleRowSchema>;

export const scheduleIndexSchema = z.object({
  asOf: timestamp,
  range: timelineRangeSchema,
  windowEnd: timestamp,
  // Plugin schedules first, then the repeats.
  schedules: z.array(scheduleRowSchema),
  runningCount: count,
});
export type ScheduleIndex = z.infer<typeof scheduleIndexSchema>;

// The instance is chosen once, when the schedule is made.
export const scheduleDraftSchema = z.object({
  name: z.string().trim().min(1, "Give it a name: it is what a run is listed under."),
  cadence: cadenceSchema,
  overlap: overlapSchema,
});
export type ScheduleDraft = z.infer<typeof scheduleDraftSchema>;

export const newScheduleSchema = scheduleDraftSchema.extend({ instanceId: id });
export type NewSchedule = z.infer<typeof newScheduleSchema>;

export const pauseRequestSchema = z.object({
  reason: z.string().trim().min(1, "Say why, so nobody resumes it too early."),
});
export type PauseRequest = z.infer<typeof pauseRequestSchema>;

export async function listSchedules(range: TimelineRange): Promise<ScheduleIndex> {
  return getJson(apiRoutes.schedules, scheduleIndexSchema, new URLSearchParams({ range }));
}

export async function createSchedule(draft: NewSchedule): Promise<ScheduleRow> {
  return postJson(apiRoutes.schedules, draft, scheduleRowSchema);
}

export async function saveSchedule(scheduleId: string, draft: ScheduleDraft): Promise<ScheduleRow> {
  return putJson(scheduleRoute(scheduleId), draft, scheduleRowSchema);
}

// Its runs on record stay, under retention like any other.
export async function deleteSchedule(scheduleId: string): Promise<void> {
  return deleteResource(scheduleRoute(scheduleId));
}

export async function pauseSchedule(
  scheduleId: string,
  request: PauseRequest,
): Promise<ScheduleRow> {
  return postJson(scheduleActionRoute(scheduleId, "pause"), request, scheduleRowSchema);
}

export async function resumeSchedule(scheduleId: string): Promise<ScheduleRow> {
  return postJson(scheduleActionRoute(scheduleId, "resume"), {}, scheduleRowSchema);
}

// By hand, now; the schedule is unchanged.
export async function runScheduleNow(scheduleId: string): Promise<Run> {
  return postJson(scheduleActionRoute(scheduleId, "run"), {}, runSchema);
}
