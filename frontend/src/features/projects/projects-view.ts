// How the Projects page arranges what the server worked out (docs/demos/shared/page-projects.js
// index; STATUS "Projects"): the proposed and active (including upcoming) are cards; the
// ended and rejected sit in tables below. Each section shows its newest projects first. Decision and period are two badges
// that never mix (projects.md §1). The target, planned, delivered and pace are the project's own
// intention's (§1.1).

import type { ProjectQuery, ProjectRow } from "@vera/contract/projects";
import {
  isSameProjectQuery,
  parseProjectSearchParams,
  projectPaces,
  projectStates,
  toProjectSearchParams,
} from "@vera/contract/projects";
import type { Project } from "@vera/domain/entities";
import type { TargetVerdict } from "@vera/domain/intentions";
import type { ProjectPeriod } from "@vera/domain/projects";
import { projectPeriods } from "@vera/domain/projects";
import type { DayPreset } from "@vera/domain/value-range";
import type { Tone } from "@/components/status-badge";
import { i18n } from "@/i18n";
import { formatCalendarDay, formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import type { NoteTone } from "@/lib/status-notes";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

const projectDatePresets = [
  "this-week",
  "next-week",
  "last-week",
  "this-month",
  "next-month",
  "last-month",
] as const satisfies readonly DayPreset[];

export const projectsView: ViewDefinition<ProjectQuery> = {
  view: "projects",
  toSearchParams: toProjectSearchParams,
  parseSearchParams: parseProjectSearchParams,
  isSameQuery: isSameProjectQuery,
  fields: [
    {
      key: "states",
      label: "projects:projectsView.decision",
      field: vocabulary(projectStates, {
        Proposed: "projects:projectState.Proposed",
        Approved: "projects:projectState.Approved",
        Rejected: "projects:projectState.Rejected",
      }),
      isQuick: true,
    },
    {
      key: "periods",
      label: "projects:projectsView.period",
      field: vocabulary(projectPeriods, {
        Upcoming: "projects:projectPeriod.Upcoming",
        Active: "projects:projectPeriod.Active",
        Ended: "projects:projectPeriod.Ended",
      }),
      isQuick: true,
    },
    {
      key: "paces",
      label: "projects:projectsView.pace",
      field: vocabulary(projectPaces, {
        BehindPace: "projects:projectPace.BehindPace",
        OnTrack: "projects:projectPace.OnTrack",
      }),
    },
    {
      key: "dates",
      label: "projects:projectsView.projectDates",
      field: { kind: "dateRange", presets: projectDatePresets },
    },
    {
      key: "timeElapsed",
      label: "projects:projectsView.timeElapsed",
      field: { kind: "numberRange", unit: "%" },
    },
    {
      key: "delivered",
      label: "projects:projectsView.delivered",
      field: { kind: "numberRange", unit: "pages" },
    },
  ],
  groupings: [],
  groupingParam: "group",
};

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
  fullyPlanned: "blue",
} as const satisfies Record<TargetVerdict, Tone>;

export interface ProjectSections {
  proposed: ProjectRow[];
  // Approved projects still running or about to start.
  active: ProjectRow[];
  ended: ProjectRow[];
  rejected: ProjectRow[];
}

const newestCreatedFirst = (first: ProjectRow, second: ProjectRow) =>
  second.project.createdAt.localeCompare(first.project.createdAt);
const newestStartedFirst = (first: ProjectRow, second: ProjectRow) =>
  second.project.startsOn.localeCompare(first.project.startsOn);

export function projectSectionsOf(rows: readonly ProjectRow[]): ProjectSections {
  const live = rows.filter((row) => row.project.state !== "Rejected" && row.period !== "Ended");
  const proposed = live
    .filter((row) => row.project.state === "Proposed")
    .toSorted(newestCreatedFirst);
  const approved = live.filter((row) => row.project.state === "Approved");
  const active = approved.toSorted(newestStartedFirst);
  const ended = rows
    .filter((row) => row.project.state !== "Rejected" && row.period === "Ended")
    .toSorted((first, second) => second.project.endsOn.localeCompare(first.project.endsOn));
  const rejected = rows
    .filter((row) => row.project.state === "Rejected")
    .toSorted((first, second) => {
      const decidedAt = (row: ProjectRow) =>
        row.project.state === "Rejected" ? row.project.at : row.project.createdAt;
      return decidedAt(second).localeCompare(decidedAt(first));
    });
  return {
    proposed,
    active,
    ended,
    rejected,
  };
}

// Of the target, in whole percent; none without one.
function deliveredPercentOf(row: ProjectRow): number | null {
  const target = row.intention.targetPages;
  return target === null ? null : Math.round((row.deliveredPages / Math.max(1, target)) * 100);
}

export function paceOf(
  row: ProjectRow,
): { text: string; tone: (typeof verdictTones)[TargetVerdict] } | null {
  if (row.verdict === null) {
    return null;
  }

  const labels = {
    onPace: i18n.t("projects:projectPace.onPace"),
    behindPace: i18n.t("projects:projectPace.behindPace"),
    targetMet: i18n.t("projects:projectPace.targetMet"),
    short: i18n.t("projects:projectPace.short", { percent: deliveredPercentOf(row) ?? 0 }),
    fullyPlanned: i18n.t("projects:projectPace.fullyPlanned"),
  } as const satisfies Record<TargetVerdict, string>;
  return { text: labels[row.verdict], tone: verdictTones[row.verdict] };
}

// "target 6,000 pp", "no target".
export function targetTextOf(row: ProjectRow): string {
  const target = row.intention.targetPages;
  return target === null
    ? i18n.t("projects:projectText.noTarget")
    : i18n.t("projects:projectText.target", { pages: formatCount(target) });
}

export function periodTextOf(project: Pick<Project, "startsOn" | "endsOn">): string {
  return i18n.t("projects:projectText.period", {
    starts: formatCalendarDay(project.startsOn),
    ends: formatCalendarDay(project.endsOn),
  });
}

export function timeLabelOf(row: ProjectRow): string {
  switch (row.period) {
    case "Upcoming":
      return i18n.t("projects:projectText.startsIn", {
        date: formatCalendarDay(row.project.startsOn),
        count: row.daysToStart,
      });
    case "Ended":
      return i18n.t("projects:projectText.ended", { date: formatCalendarDay(row.project.endsOn) });
    case "Active":
      return i18n.t("projects:projectText.elapsed", {
        percent: Math.round(row.timeElapsed * 100),
        count: row.daysLeft,
      });
  }
}

// Nothing is planned or delivered before anything is funded, nor drawn against no target.
export function pagesOf(row: ProjectRow) {
  return row.fundedCount === 0 || row.intention.targetPages === null
    ? null
    : { planned: row.plannedPages, delivered: row.deliveredPages };
}

export interface ProjectNote {
  tone: NoteTone;
  title: string;
  body: string;
}

// Where it stands, in words, at the top of its page (page-projects.js detail).
export function projectNoteOf(row: ProjectRow, decidedBy: string): ProjectNote {
  const { project, pending, waiting } = row;
  const target = row.intention.targetPages;
  const delivered = deliveredPercentOf(row) ?? 0;
  switch (project.state) {
    case "Proposed":
      return {
        tone: "amber",
        title: i18n.t("projects:projectNote.proposedTitle"),
        body:
          pending.documentCount === 0
            ? i18n.t("projects:projectNote.proposedEmpty")
            : i18n.t("projects:projectNote.proposedPending", {
                count: pending.documentCount,
                copies:
                  pending.withCopyCount > 0
                    ? i18n.t("projects:projectNote.proposedCopies", {
                        count: pending.withCopyCount,
                      })
                    : "",
              }),
      };
    case "Rejected":
      return {
        tone: "red",
        title: i18n.t("projects:projectNote.rejectedTitle", {
          date: formatDay(project.at),
          name: decidedBy,
        }),
        body: i18n.t("projects:projectNote.rejectedBody", { reason: project.reason }),
      };
    case "Approved":
      break;
  }

  if (row.period === "Upcoming") {
    return {
      tone: "slate",
      title: i18n.t("projects:projectNote.upcomingTitle", {
        date: formatCalendarDay(project.startsOn),
      }),
      body: i18n.t("projects:projectNote.upcomingBody"),
    };
  }

  if (row.period === "Ended") {
    if (target === null) {
      return {
        tone: "slate",
        title: i18n.t("projects:projectNote.endedNoTargetTitle", {
          date: formatCalendarDay(project.endsOn),
        }),
        body: i18n.t("projects:projectNote.endedNoTargetBody", {
          pages: formatCount(row.deliveredPages),
        }),
      };
    }

    const short = target - row.deliveredPages;
    return {
      tone: paceOf(row)?.tone ?? "slate",
      title:
        delivered >= 100
          ? i18n.t("projects:projectNote.endedTargetMetTitle", {
              date: formatCalendarDay(project.endsOn),
            })
          : i18n.t("projects:projectNote.endedTargetTitle", {
              date: formatCalendarDay(project.endsOn),
              percent: delivered,
            }),
      body: i18n.t("projects:projectNote.endedTargetBody", {
        pages: formatCount(row.deliveredPages),
        target: formatCount(target),
        shortText:
          short > 0 ? i18n.t("projects:projectNote.short", { pages: formatCount(short) }) : "",
      }),
    };
  }

  const pace = paceOf(row);
  const daysLeft = i18n.t("projects:projectText.daysLeft", { count: row.daysLeft });
  if (row.fundedCount === 0) {
    return {
      tone: "amber",
      title: i18n.t("projects:projectNote.runningUnfundedTitle", {
        date: formatCalendarDay(project.startsOn),
      }),
      body: i18n.t("projects:projectNote.runningUnfundedBody", { days: daysLeft }),
    };
  }

  if (pace === null) {
    return {
      tone: "slate",
      title: i18n.t("projects:projectNote.runningNoTargetTitle", {
        date: formatCalendarDay(project.startsOn),
      }),
      body: i18n.t("projects:projectNote.runningNoTargetBody", {
        days: daysLeft,
        pages: formatCount(row.deliveredPages),
      }),
    };
  }

  const onLists = row.plannedPages - row.deliveredPages;
  return {
    tone: pace.tone,
    title: i18n.t("projects:projectNote.runningTitle", {
      pace: pace.text,
      delivered,
      elapsed: Math.round(row.timeElapsed * 100),
    }),
    body: [
      daysLeft,
      onLists > 0
        ? i18n.t("projects:projectNote.onLists", { pages: formatCount(onLists) })
        : i18n.t("projects:projectNote.noRunningList"),
      waiting.itemCount > 0
        ? i18n.t("projects:projectNote.waitingForList", { pages: formatCount(waiting.pages) })
        : null,
    ]
      .filter((part) => part !== null)
      .join(" "),
  };
}
