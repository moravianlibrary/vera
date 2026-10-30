// What Tasks and Schedules say about runs and time (docs/demos/shared/page-tasks.js): a trigger,
// an overlap, how long a run took. A run's state is components/run-state-badge.tsx's, a cadence
// lib/format-cadence.ts's and a moment lib/format-moment.ts's.

import type { Overlap } from "@vera/domain/schedules";
import type { TriggerKind } from "@vera/domain/tasks";
import { i18n } from "@/i18n";

export const triggerLabels = {
  schedule: "tasks:taskWords.schedule",
  approval: "tasks:taskWords.approval",
  manual: "tasks:taskWords.manual",
  repeat: "tasks:taskWords.repeat",
} as const satisfies Record<TriggerKind, string>;

export const overlapLabels = {
  skip: "tasks:taskWords.skip",
  wait: "tasks:taskWords.wait",
} as const satisfies Record<Overlap, string>;

// Under a cadence, what an overlapping run does.
export const overlapNotes = {
  skip: "tasks:taskWords.skipsOverlap",
  wait: "tasks:taskWords.waitsPrevious",
} as const satisfies Record<Overlap, string>;

// "Monthly output — {period}" as one of its occurrences is named.
export function repeatNameOf(pattern: string): string {
  return pattern.replace("{period}", i18n.t("tasks:taskWords.ellipsis"));
}

// "38 s", "4 min 12 s", "1 h 5 min".
export function durationText(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) {
    return i18n.t("tasks:taskWords.seconds", { count: seconds });
  }

  if (seconds < 3600) {
    return i18n.t("tasks:taskWords.minutesSeconds", {
      minutes: Math.floor(seconds / 60),
      seconds: seconds % 60,
    });
  }

  return i18n.t("tasks:taskWords.hoursMinutes", {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
  });
}

// "under a minute left", "about 4 min left", "about 2 h left".
export function timeLeftText(seconds: number): string {
  if (seconds < 60) {
    return i18n.t("tasks:taskWords.underMinuteLeft");
  }

  if (seconds < 3600) {
    return i18n.t("tasks:taskWords.minutesLeft", { count: Math.round(seconds / 60) });
  }

  return i18n.t("tasks:taskWords.hoursLeft", { count: Math.round(seconds / 3600) });
}

// How long a run took, or has been running.
export function tookText(
  run: { startedAt: string; finishedAt: string | null },
  asOf: string,
): string {
  const end = run.finishedAt ?? asOf;
  return durationText(Date.parse(end) - Date.parse(run.startedAt));
}
