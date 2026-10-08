// How the Projects page arranges what the server worked out (docs/demos/shared/page-projects.js
// index; STATUS "Projects"): the proposed, active and upcoming projects are cards; the
// ended and rejected sit in tables below. Each section shows its newest projects first. Decision and period are two badges
// that never mix (projects.md §1). The target, planned, delivered and pace are the project's own
// intention's (§1.1).
// TODO(rrandiak): labels move to i18n.

import type { ProjectQuery, ProjectRow } from "@/api/projects";
import {
  isSameProjectQuery,
  parseProjectSearchParams,
  projectPaces,
  projectStates,
  toProjectSearchParams,
} from "@/api/projects";
import type { Tone } from "@/components/status-badge";
import type { Project } from "@/domain/entities";
import type { TargetVerdict } from "@/domain/intentions";
import type { ProjectPeriod } from "@/domain/projects";
import { projectPeriods } from "@/domain/projects";
import type { NoteTone } from "@/domain/status-notes";
import { formatCalendarDay, formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const projectsView: ViewDefinition<ProjectQuery> = {
  view: "projects",
  toSearchParams: toProjectSearchParams,
  parseSearchParams: parseProjectSearchParams,
  isSameQuery: isSameProjectQuery,
  fields: [
    {
      key: "states",
      label: "Decision",
      field: vocabulary(projectStates, {
        Proposed: "Proposed",
        Approved: "Approved",
        Rejected: "Rejected",
      }),
      isQuick: true,
    },
    {
      key: "periods",
      label: "Period",
      field: vocabulary(projectPeriods, { Upcoming: "Upcoming", Active: "Active", Ended: "Ended" }),
      isQuick: true,
    },
    {
      key: "paces",
      label: "Pace",
      field: vocabulary(projectPaces, { BehindPace: "Behind pace", OnTrack: "On track" }),
    },
    { key: "dates", label: "Project dates", field: { kind: "dateRange", presets: [] } },
    { key: "timeElapsed", label: "Time elapsed", field: { kind: "numberRange", unit: "%" } },
    { key: "delivered", label: "Delivered", field: { kind: "numberRange", unit: "pages" } },
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
  // Proposed, then active, then upcoming.
  cards: ProjectRow[];
  ended: ProjectRow[];
  rejected: ProjectRow[];
  counts: { proposed: number; active: number; upcoming: number; ended: number; rejected: number };
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
  const active = approved.filter((row) => row.period === "Active").toSorted(newestStartedFirst);
  const upcoming = approved.filter((row) => row.period === "Upcoming").toSorted(newestStartedFirst);
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
    cards: [...proposed, ...active, ...upcoming],
    ended,
    rejected,
    counts: {
      proposed: proposed.length,
      active: active.length,
      upcoming: upcoming.length,
      ended: ended.length,
      rejected: rejected.length,
    },
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
    onPace: "On pace",
    behindPace: "Behind pace",
    targetMet: "Target met",
    short: `${deliveredPercentOf(row) ?? 0}% delivered`,
    fullyPlanned: "Fully planned",
  } as const satisfies Record<TargetVerdict, string>;
  return { text: labels[row.verdict], tone: verdictTones[row.verdict] };
}

// "target 6,000 pp", "no target".
export function targetTextOf(row: ProjectRow): string {
  const target = row.intention.targetPages;
  return target === null ? "no target" : `target ${formatCount(target)} pp`;
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
        title: "Proposed — waiting for a curator to approve or reject it",
        body:
          pending.documentCount === 0
            ? "Nothing is proposed into it yet; members can propose while it waits."
            : `${plural(pending.documentCount, "document is", "documents are")} proposed into it. Approving approves them at the priority it picks${
                pending.withCopyCount > 0
                  ? `, except ${pending.withCopyCount} with a copy, each decided on its own as a rescan`
                  : ""
              }.`,
      };
    case "Rejected":
      return {
        tone: "red",
        title: `Rejected ${formatDay(project.at)} by ${decidedBy}`,
        body: `${project.reason} It takes no more proposals, and the decision is final — to try again, start a new project.`,
      };
    case "Approved":
      break;
  }

  if (row.period === "Upcoming") {
    return {
      tone: "slate",
      title: `Approved · starts ${formatCalendarDay(project.startsOn)}`,
      body: "Nothing is delivered before it starts.",
    };
  }

  if (row.period === "Ended") {
    if (target === null) {
      return {
        tone: "slate",
        title: `Ended ${formatCalendarDay(project.endsOn)} — it had no target`,
        body: `${formatCount(row.deliveredPages)} pages digitized. These numbers stay true: the pages it funded are funded by it for good.`,
      };
    }

    const short = target - row.deliveredPages;
    return {
      tone: paceOf(row)?.tone ?? "slate",
      title: `Ended ${formatCalendarDay(project.endsOn)} — ${delivered >= 100 ? "target met" : `${delivered}% of the target delivered`}`,
      body: `${formatCount(row.deliveredPages)} of ${formatCount(target)} pages digitized${
        short > 0 ? `, ${formatCount(short)} short` : ""
      }. These numbers stay true: the pages it funded are funded by it for good.`,
    };
  }

  const pace = paceOf(row);
  const daysLeft = `${plural(row.daysLeft, "day")} left.`;
  if (row.fundedCount === 0) {
    return {
      tone: "amber",
      title: `Running since ${formatCalendarDay(project.startsOn)}, and nothing is funded by it yet`,
      body: `${daysLeft} No approved request names this project.`,
    };
  }

  if (pace === null) {
    return {
      tone: "slate",
      title: `Running since ${formatCalendarDay(project.startsOn)}, with no target`,
      body: `${daysLeft} ${formatCount(row.deliveredPages)} pages digitized so far; its intention tracks the mix.`,
    };
  }

  const onLists = row.plannedPages - row.deliveredPages;
  return {
    tone: pace.tone,
    title: `${pace.text} — ${delivered}% delivered with ${Math.round(row.timeElapsed * 100)}% of the time gone`,
    body: [
      daysLeft,
      onLists > 0
        ? `${formatCount(onLists)} pp are on lists and not digitized yet.`
        : "Nothing of it is on a running list.",
      waiting.itemCount > 0
        ? `${formatCount(waiting.pages)} pp more are approved and waiting for a list.`
        : null,
    ]
      .filter((part) => part !== null)
      .join(" "),
  };
}
