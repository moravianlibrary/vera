// What is worked out about a project rather than stored (projects.md §1): its period, from the
// dates and today. The decision is stored and never mixes with the period. A project has no
// target or pace of its own: those are its intention's (§1.1, `domain/intentions.ts`).

import type { Project } from "@/domain/entities";
import type { ScopedRecord } from "@/domain/permissions";

export const projectPeriods = ["Upcoming", "Active", "Ended"] as const;
export type ProjectPeriod = (typeof projectPeriods)[number];

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
