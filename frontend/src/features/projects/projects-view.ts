// How the Projects page arranges what the server worked out (docs/demos/shared/page-projects.js
// index; STATUS "Projects"): the proposed, active and upcoming projects are cards, those waiting
// for a decision first, then the running ones by their end, then what is coming by its start; the
// ended and the rejected sit in tables below, latest first. Decision and period are two badges
// that never mix (projects.md §1).
// TODO(rrandiak): labels move to i18n.

import type { ProjectRow } from "@/api/projects";
import type { Tone } from "@/components/status-badge";
import type { Project } from "@/domain/entities";
import type { PaceVerdict, ProjectPeriod } from "@/domain/projects";
import { formatCalendarDay } from "@/lib/format-date";
import { plural } from "@/lib/plural";

export const decisionTones = {
  Proposed: "amber",
  Approved: "green",
  Rejected: "red",
} as const satisfies Record<Project["state"], Tone>;

export const periodTones = {
  Upcoming: "slate",
  Active: "blue",
  Ended: "slate",
} as const satisfies Record<ProjectPeriod, Tone>;

const verdictTones = {
  onPace: "green",
  behindPace: "amber",
  targetMet: "green",
  short: "amber",
} as const satisfies Record<PaceVerdict, Tone>;

export interface ProjectSections {
  // Proposed, then active, then upcoming.
  cards: ProjectRow[];
  ended: ProjectRow[];
  rejected: ProjectRow[];
  counts: { proposed: number; active: number; upcoming: number; ended: number };
}

const byStart = (first: ProjectRow, second: ProjectRow) =>
  first.project.startsOn.localeCompare(second.project.startsOn);

export function projectSectionsOf(rows: readonly ProjectRow[]): ProjectSections {
  const live = rows.filter((row) => row.project.state !== "Rejected" && row.period !== "Ended");
  const proposed = live.filter((row) => row.project.state === "Proposed").toSorted(byStart);
  const approved = live.filter((row) => row.project.state === "Approved");
  const active = approved
    .filter((row) => row.period === "Active")
    .toSorted((first, second) => first.project.endsOn.localeCompare(second.project.endsOn));
  const upcoming = approved.filter((row) => row.period === "Upcoming").toSorted(byStart);
  const ended = rows
    .filter((row) => row.project.state !== "Rejected" && row.period === "Ended")
    .toSorted((first, second) => second.project.endsOn.localeCompare(first.project.endsOn));
  const rejected = rows
    .filter((row) => row.project.state === "Rejected")
    .toSorted((first, second) => byStart(second, first));
  return {
    cards: [...proposed, ...active, ...upcoming],
    ended,
    rejected,
    counts: {
      proposed: proposed.length,
      active: active.length,
      upcoming: upcoming.length,
      ended: ended.length,
    },
  };
}

export function paceOf(row: ProjectRow): { text: string; tone: Tone } | null {
  if (row.verdict === null) {
    return null;
  }

  const labels = {
    onPace: "On pace",
    behindPace: "Behind pace",
    targetMet: "Target met",
    short: `${Math.round((row.deliveredPages / Math.max(1, row.project.targetPages)) * 100)}% delivered`,
  } as const satisfies Record<PaceVerdict, string>;
  return { text: labels[row.verdict], tone: verdictTones[row.verdict] };
}

export function periodTextOf(project: Pick<Project, "startsOn" | "endsOn">): string {
  return `${formatCalendarDay(project.startsOn)} → ${formatCalendarDay(project.endsOn)}`;
}

export function timeLabelOf(row: ProjectRow): string {
  switch (row.period) {
    case "Upcoming":
      return `starts ${formatCalendarDay(row.project.startsOn)} · in ${plural(row.daysToStart, "day")}`;
    case "Ended":
      return `ended ${formatCalendarDay(row.project.endsOn)}`;
    case "Active":
      return `${Math.round(row.timeElapsed * 100)}% elapsed · ${plural(row.daysLeft, "day")} left`;
  }
}

// Nothing is planned or delivered before anything is funded.
export function pagesOf(row: ProjectRow) {
  return row.fundedCount === 0
    ? null
    : { planned: row.plannedPages, delivered: row.deliveredPages };
}
