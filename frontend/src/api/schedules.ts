// Calls the schedules endpoints; what they take and answer is in @vera/contract/schedules.

import { apiRoutes, scheduleActionRoute, scheduleRoute } from "@vera/contract/routes";
import type {
  NewSchedule,
  PauseRequest,
  ScheduleDraft,
  ScheduleIndex,
  ScheduleRow,
  TimelineRange,
} from "@vera/contract/schedules";
import { scheduleIndexSchema, scheduleRowSchema } from "@vera/contract/schedules";
import type { Run } from "@vera/contract/tasks";
import { runSchema } from "@vera/contract/tasks";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";

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
