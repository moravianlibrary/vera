// What is worked out about a project rather than stored (projects.md §1): its period, from the
// dates and today, and its pace, from what it funded against the time used up. The decision is
// stored and never mixes with the period. Pace exists only for an Approved project that has
// started and funds something (docs/demos/shared/page-projects.js, STATUS "Projects").

import type { Project } from "@/domain/entities";
import type { ScopedRecord } from "@/domain/permissions";

export const projectPeriods = ["Upcoming", "Active", "Ended"] as const;
export type ProjectPeriod = (typeof projectPeriods)[number];

export const paceVerdicts = ["onPace", "behindPace", "targetMet", "short"] as const;
export type PaceVerdict = (typeof paceVerdicts)[number];

// Ten points of slack: a grant is not behind because one list is still running.
export const paceSlack = 0.1;

const dayInMilliseconds = 86_400_000;

const millisecondsOf = (calendarDate: string) => Date.parse(`${calendarDate}T00:00:00Z`);

// The last day is part of the period.
export function periodOf(
  project: Pick<Project, "startsOn" | "endsOn">,
  today: string,
): ProjectPeriod {
  if (today < project.startsOn) {
    return "Upcoming";
  }

  return today > project.endsOn ? "Ended" : "Active";
}

// How much of the period is gone by the start of today, 0 to 1.
export function timeElapsedOf(
  project: Pick<Project, "startsOn" | "endsOn">,
  today: string,
): number {
  const starts = millisecondsOf(project.startsOn);
  const length = millisecondsOf(project.endsOn) + dayInMilliseconds - starts;
  const elapsed = (millisecondsOf(today) - starts) / length;
  return Math.min(1, Math.max(0, elapsed));
}

// Whole days from today to the date; negative once it is past.
export function daysUntil(calendarDate: string, today: string): number {
  return Math.round((millisecondsOf(calendarDate) - millisecondsOf(today)) / dayInMilliseconds);
}

export interface PaceInput {
  project: Pick<Project, "state" | "startsOn" | "endsOn" | "targetPages">;
  fundedCount: number;
  deliveredPages: number;
  today: string;
}

// Delivered against the share of the time gone: within the slack reads on pace. An ended project
// met its target or fell short.
export function paceVerdictOf({
  project,
  fundedCount,
  deliveredPages,
  today,
}: PaceInput): PaceVerdict | null {
  const period = periodOf(project, today);
  if (project.state !== "Approved" || period === "Upcoming" || fundedCount === 0) {
    return null;
  }

  const delivered = project.targetPages === 0 ? 1 : deliveredPages / project.targetPages;
  if (period === "Ended") {
    return delivered >= 1 ? "targetMet" : "short";
  }

  return delivered >= timeElapsedOf(project, today) - paceSlack ? "onPace" : "behindPace";
}

// Where planned and delivered would be at an even pace by today; only while an Approved project
// runs.
export function evenPaceOf(project: Pick<Project, "state" | "startsOn" | "endsOn">, today: string) {
  return project.state === "Approved" && periodOf(project, today) === "Active"
    ? timeElapsedOf(project, today)
    : null;
}

// Members directly or through a group; the manager is always one (projects.md §3).
export function isProjectMember(
  project: Pick<Project, "managerId" | "memberIds" | "memberGroupIds">,
  userId: string,
  groupIds: readonly string[],
): boolean {
  return (
    project.managerId === userId ||
    project.memberIds.includes(userId) ||
    project.memberGroupIds.some((groupId) => groupIds.includes(groupId))
  );
}

export function scopeOfProject(
  project: Pick<Project, "managerId" | "memberIds" | "memberGroupIds">,
): ScopedRecord {
  return {
    kind: "project",
    managerId: project.managerId,
    memberIds: project.memberIds,
    memberGroupIds: project.memberGroupIds,
  };
}
