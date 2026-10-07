// What Tasks and Schedules say about runs and time (docs/demos/shared/page-tasks.js): a state and
// its tone, a trigger, a cadence, how long a run took. Moments are worded by lib/format-moment.ts.
// TODO(rrandiak): labels move to i18n.

import type { Tone } from "@/components/status-badge";
import type { Cadence, Overlap } from "@/domain/schedules";
import type { RunState, TriggerKind } from "@/domain/tasks";

export const runStateLabels = {
  Running: "Running",
  Done: "Done",
  DoneWithErrors: "Done with errors",
  Failed: "Failed",
  Cancelled: "Cancelled",
  Skipped: "Skipped",
} as const satisfies Record<RunState, string>;

export const runStateTones = {
  Running: "blue",
  Done: "green",
  DoneWithErrors: "amber",
  Failed: "red",
  Cancelled: "slate",
  Skipped: "slate",
} as const satisfies Record<RunState, Tone>;

export const triggerLabels = {
  schedule: "Schedule",
  approval: "On approval",
  manual: "Started by a person",
  repeat: "Intention repeat",
} as const satisfies Record<TriggerKind, string>;

export const overlapLabels = {
  skip: "Skip this run",
  wait: "Wait, then run",
} as const satisfies Record<Overlap, string>;

// Under a cadence, what an overlapping run does.
export const overlapNotes = {
  skip: "skips an overlapping run",
  wait: "waits for the previous run",
} as const satisfies Record<Overlap, string>;

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayName(weekday: number): string {
  return weekdayNames[weekday] ?? "";
}

export function cadenceText(cadence: Cadence): string {
  switch (cadence.every) {
    case "minutes":
      return `every ${cadence.interval} min`;
    case "hours":
      return cadence.interval === 1 ? "hourly" : `every ${cadence.interval} hours`;
    case "day":
      return `daily at ${cadence.at}`;
    case "week":
      return `weekly, ${weekdayName(cadence.weekday)} ${cadence.at}`;
    case "month":
      return `monthly, day ${cadence.day} at ${cadence.at}`;
    case "quarter":
      return `quarterly, day 1 at ${cadence.at}`;
  }
}

// "Monthly output — {period}" as one of its occurrences is named.
export function repeatNameOf(pattern: string): string {
  return pattern.replace("{period}", "…");
}

// "38 s", "4 min 12 s", "1 h 5 min".
export function durationText(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) {
    return `${seconds} s`;
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  }

  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
}

// "under a minute left", "about 4 min left", "about 2 h left".
export function timeLeftText(seconds: number): string {
  if (seconds < 60) {
    return "under a minute left";
  }

  if (seconds < 3600) {
    return `about ${Math.round(seconds / 60)} min left`;
  }

  return `about ${Math.round(seconds / 3600)} h left`;
}

// How long a run took, or has been running.
export function tookText(
  run: { startedAt: string; finishedAt: string | null },
  asOf: string,
): string {
  const end = run.finishedAt ?? asOf;
  return durationText(Date.parse(end) - Date.parse(run.startedAt));
}
