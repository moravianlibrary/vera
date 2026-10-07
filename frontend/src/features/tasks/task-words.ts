// What Tasks and Schedules say about runs and time (docs/demos/shared/page-tasks.js): a trigger,
// an overlap, how long a run took. A run's state is components/run-state-badge.tsx's, a cadence
// lib/format-cadence.ts's and a moment lib/format-moment.ts's.
// TODO(rrandiak): labels move to i18n.

import type { Overlap } from "@/domain/schedules";
import type { TriggerKind } from "@/domain/tasks";

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
