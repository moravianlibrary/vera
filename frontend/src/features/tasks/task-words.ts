// What Tasks and Schedules say about runs and time (docs/demos/shared/page-tasks.js): a state and
// its tone, a trigger, a cadence, and a moment read against the server's own (`asOf`), since the
// server's clock, not the browser's, says how long ago a run started or how soon one is due.
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

// ---------------------------------------------------------------- moments

const minuteMilliseconds = 60_000;

const clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const shortDayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

export function clockTimeOf(moment: string | Date): string {
  return clockFormat.format(new Date(moment));
}

// "14 Jun".
export function shortDayOf(moment: string | Date): string {
  return shortDayFormat.format(new Date(moment));
}

// "25 Jun 10:38".
export function dayAndTimeOf(moment: string | Date): string {
  const date = new Date(moment);
  return `${shortDayFormat.format(date)} ${clockFormat.format(date)}`;
}

// Whole days between the two moments' dates, in the library's own time.
function daysBetween(from: Date, to: Date): number {
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(
    (startOf(to).getTime() - startOf(from).getTime()) / (24 * 60 * minuteMilliseconds),
  );
}

// "just now", "12 min ago", "today 06:00", "yesterday 14:05", "22 Jun 14:05".
export function agoText(moment: string, asOf: string): string {
  const at = new Date(moment);
  const now = new Date(asOf);
  const minutes = Math.round((now.getTime() - at.getTime()) / minuteMilliseconds);
  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const days = daysBetween(at, now);
  if (days === 0) {
    return `today ${clockTimeOf(at)}`;
  }

  return days === 1 ? `yesterday ${clockTimeOf(at)}` : dayAndTimeOf(at);
}

// "in 5 min", "today 18:00", "tomorrow 02:00", "Mon 29 Jun 06:00".
export function aheadText(moment: string, asOf: string): string {
  const at = new Date(moment);
  const now = new Date(asOf);
  const minutes = Math.round((at.getTime() - now.getTime()) / minuteMilliseconds);
  if (minutes < 60) {
    return `in ${Math.max(1, minutes)} min`;
  }

  const days = daysBetween(now, at);
  if (days === 0) {
    return `today ${clockTimeOf(at)}`;
  }

  return days === 1
    ? `tomorrow ${clockTimeOf(at)}`
    : `${weekdayFormat.format(at)} ${dayAndTimeOf(at)}`;
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
