// What the server does for Schedules (page-composition.md §5 *Tasks*; STATUS "Tasks";
// permissions.md §3): with `task.read`, every plugin schedule and then the intention repeats,
// each with its last run, its next and the runs it makes over the timeline's window. Making,
// editing, pausing, resuming and deleting a schedule is `task.schedule`'s; *Run now* is
// `plugin.run`'s and leaves the schedule as it was. A repeat is listed, never changed here.

import type {
  NewSchedule,
  PauseRequest,
  ScheduleDraft,
  ScheduleIndex,
  ScheduleRow,
  TimelineRange,
} from "@/api/schedules";
import { listedRunCeiling } from "@/api/schedules";
import type { Run } from "@/api/tasks";
import type { Session } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import type { Cadence } from "@/domain/schedules";
import {
  isTooFrequent,
  nextOccurrenceOf,
  occurrencesOf,
  repeatCadenceOf,
  schedulableKinds,
} from "@/domain/schedules";
import { database } from "@/mocks/database";
import type { StoredSchedule } from "@/mocks/fixtures/tasks";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { publicRunOf, startRun } from "@/mocks/tasks";
import { mockNow } from "@/mocks/today";

const dayMilliseconds = 24 * 60 * 60_000;

const windowDays = { day: 1, week: 7, month: 30 } as const satisfies Record<TimelineRange, number>;

export function canReadSchedules(session: Session): boolean {
  return hasPermission(session, "task.read");
}

// ---------------------------------------------------------------- the page

interface Listed {
  readonly id: string;
  readonly name: string;
  readonly source: ScheduleRow["source"];
  readonly cadence: Cadence;
  readonly overlap: ScheduleRow["overlap"];
  readonly pause: StoredSchedule["pause"];
  readonly createdBy: string;
  readonly since: string;
}

function listedSchedules(): Listed[] {
  const plugin = database.schedules.flatMap((schedule): Listed[] => {
    const instance = database.pluginInstances.find(
      (candidate) => candidate.id === schedule.instanceId,
    );
    return instance === undefined ? [] : [{ ...schedule, source: { kind: "plugin", instance } }];
  });
  const repeats = database.intentionTemplates.map(
    (template): Listed => ({
      id: template.id,
      name: template.namePattern.replace("{period}", "next period"),
      source: { kind: "repeat", templateId: template.id },
      cadence: repeatCadenceOf(template.every),
      overlap: "skip",
      pause: null,
      createdBy: template.createdBy,
      since: template.since,
    }),
  );
  return [...plugin, ...repeats];
}

function rowOf(listed: Listed, now: Date, windowEnd: Date): ScheduleRow {
  const runs = database.runs
    .filter(
      (run) =>
        (run.trigger.kind === "schedule" && run.trigger.scheduleId === listed.id) ||
        (run.trigger.kind === "repeat" && run.trigger.templateId === listed.id),
    )
    .map((run) => publicRunOf(run, now))
    .toSorted((first, second) => Date.parse(second.startedAt) - Date.parse(first.startedAt));
  const [lastRun] = runs;
  const isPaused = listed.pause !== null;
  const inWindow = isPaused ? [] : occurrencesOf(listed.cadence, now, windowEnd);
  return {
    id: listed.id,
    name: listed.name,
    source: listed.source,
    cadence: listed.cadence,
    overlap: listed.overlap,
    pause:
      listed.pause === null
        ? null
        : {
            pausedBy: listed.pause.pausedBy,
            pausedAt: listed.pause.pausedAt.toISOString(),
            reason: listed.pause.reason,
          },
    createdBy: listed.createdBy,
    since: listed.since,
    lastRun:
      lastRun === undefined
        ? null
        : {
            id: lastRun.id,
            state: lastRun.state,
            startedAt: lastRun.startedAt,
            errorCount: lastRun.errorCount,
          },
    nextAt: isPaused ? null : (nextOccurrenceOf(listed.cadence, now)?.toISOString() ?? null),
    runCount: runs.length,
    window: {
      runCount: inWindow.length,
      runsAt:
        inWindow.length > listedRunCeiling ? [] : inWindow.map((moment) => moment.toISOString()),
    },
  };
}

export function querySchedules(range: TimelineRange): ScheduleIndex {
  const now = mockNow();
  const windowEnd = new Date(now.getTime() + windowDays[range] * dayMilliseconds);
  return {
    asOf: now.toISOString(),
    range,
    windowEnd: windowEnd.toISOString(),
    schedules: listedSchedules().map((listed) => rowOf(listed, now, windowEnd)),
    runningCount: database.runs
      .map((run) => publicRunOf(run, now))
      .filter((run) => run.state === "Running").length,
  };
}

function rowById(scheduleId: string): ScheduleRow | null {
  const now = mockNow();
  const listed = listedSchedules().find((candidate) => candidate.id === scheduleId);
  return listed === undefined ? null : rowOf(listed, now, now);
}

// ---------------------------------------------------------------- acts

const mayNotSchedule: Refusal = { status: 403, message: "You may not change schedules" };
const noSuchSchedule: Refusal = { status: 404, message: "No such schedule" };

function cadenceRefusal(cadence: Cadence): Refusal | null {
  if (cadence.every === "quarter") {
    return { status: 422, message: "A plugin schedule is not quarterly" };
  }

  if (isTooFrequent(cadence)) {
    return {
      status: 422,
      message: "Every 5 minutes is the shortest",
      code: "schedule.too_often",
    };
  }

  return null;
}

function storedIndexOf(scheduleId: string): number {
  return database.schedules.findIndex((schedule) => schedule.id === scheduleId);
}

function replaceStored(index: number, schedule: StoredSchedule): Outcome<ScheduleRow> {
  database.schedules.splice(index, 1, schedule);
  const row = rowById(schedule.id);
  return row === null ? { refusal: noSuchSchedule } : { value: row };
}

export function createSchedule(session: Session, draft: NewSchedule): Outcome<ScheduleRow> {
  if (!hasPermission(session, "task.schedule")) {
    return { refusal: mayNotSchedule };
  }

  const instance = database.pluginInstances.find((candidate) => candidate.id === draft.instanceId);
  const isSchedulable =
    instance !== undefined && (schedulableKinds as readonly string[]).includes(instance.kind);
  if (!isSchedulable) {
    return {
      refusal: {
        status: 422,
        message: "That plugin runs only while somebody uses it",
        code: "schedule.not_schedulable",
      },
    };
  }

  const refusal = cadenceRefusal(draft.cadence);
  if (refusal !== null) {
    return { refusal };
  }

  const highest = Math.max(
    0,
    ...database.schedules.map((schedule) => Number.parseInt(schedule.id.slice(1), 10) || 0),
  );
  const schedule: StoredSchedule = {
    id: `s${highest + 1}`,
    instanceId: draft.instanceId,
    name: draft.name.trim(),
    cadence: draft.cadence,
    overlap: draft.overlap,
    pause: null,
    createdBy: session.user.id,
    since: calendarDayOf(mockNow()),
  };
  database.schedules.push(schedule);
  const row = rowById(schedule.id);
  return row === null ? { refusal: noSuchSchedule } : { value: row };
}

export function saveSchedule(
  session: Session,
  scheduleId: string,
  draft: ScheduleDraft,
): Outcome<ScheduleRow> {
  if (!hasPermission(session, "task.schedule")) {
    return { refusal: mayNotSchedule };
  }

  const index = storedIndexOf(scheduleId);
  const stored = database.schedules[index];
  if (stored === undefined) {
    return { refusal: noSuchSchedule };
  }

  const refusal = cadenceRefusal(draft.cadence);
  if (refusal !== null) {
    return { refusal };
  }

  return replaceStored(index, {
    ...stored,
    name: draft.name.trim(),
    cadence: draft.cadence,
    overlap: draft.overlap,
  });
}

// Its runs on record stay, under retention like any other.
export function deleteSchedule(session: Session, scheduleId: string): Outcome<null> {
  if (!hasPermission(session, "task.schedule")) {
    return { refusal: mayNotSchedule };
  }

  const index = storedIndexOf(scheduleId);
  if (index < 0) {
    return { refusal: noSuchSchedule };
  }

  database.schedules.splice(index, 1);
  return { value: null };
}

export function pauseSchedule(
  session: Session,
  scheduleId: string,
  request: PauseRequest,
): Outcome<ScheduleRow> {
  if (!hasPermission(session, "task.schedule")) {
    return { refusal: mayNotSchedule };
  }

  const index = storedIndexOf(scheduleId);
  const stored = database.schedules[index];
  if (stored === undefined) {
    return { refusal: noSuchSchedule };
  }

  if (stored.pause !== null) {
    return {
      refusal: { status: 409, message: "It is already paused", code: "schedule.paused" },
    };
  }

  return replaceStored(index, {
    ...stored,
    pause: { pausedBy: session.user.id, pausedAt: mockNow(), reason: request.reason.trim() },
  });
}

export function resumeSchedule(session: Session, scheduleId: string): Outcome<ScheduleRow> {
  if (!hasPermission(session, "task.schedule")) {
    return { refusal: mayNotSchedule };
  }

  const index = storedIndexOf(scheduleId);
  const stored = database.schedules[index];
  if (stored === undefined) {
    return { refusal: noSuchSchedule };
  }

  if (stored.pause === null) {
    return {
      refusal: { status: 409, message: "It is not paused", code: "schedule.not_paused" },
    };
  }

  return replaceStored(index, { ...stored, pause: null });
}

export function runScheduleNow(session: Session, scheduleId: string): Outcome<Run> {
  if (!hasPermission(session, "plugin.run")) {
    return { refusal: { status: 403, message: "You may not run plugins" } };
  }

  const stored = database.schedules.find((schedule) => schedule.id === scheduleId);
  if (stored === undefined) {
    return { refusal: noSuchSchedule };
  }

  const lastRun = database.runs.find(
    (run) => run.trigger.kind === "schedule" && run.trigger.scheduleId === scheduleId,
  );
  const started = startRun({
    what: stored.name,
    instanceId: stored.instanceId,
    trigger: { kind: "manual", from: { label: "Schedules", path: `/schedules?s=${scheduleId}` } },
    startedBy: session.user.id,
    itemCount: lastRun?.itemCount || 100,
    rerunOf: null,
  });
  return { value: publicRunOf(started, mockNow()) };
}

function calendarDayOf(moment: Date): string {
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const day = String(moment.getDate()).padStart(2, "0");
  return `${moment.getFullYear()}-${month}-${day}`;
}
