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
import type { NoteTone } from "@/domain/status-notes";
import { formatCalendarDay, formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
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

export function paceOf(
  row: ProjectRow,
): { text: string; tone: (typeof verdictTones)[PaceVerdict] } | null {
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

export interface ProjectNote {
  tone: NoteTone;
  title: string;
  body: string;
}

// Where it stands, in words, at the top of its page (page-projects.js detail).
export function projectNoteOf(row: ProjectRow, decidedBy: string): ProjectNote {
  const { project, pending, waiting } = row;
  const delivered = Math.round((row.deliveredPages / Math.max(1, project.targetPages)) * 100);
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
    const short = project.targetPages - row.deliveredPages;
    return {
      tone: paceOf(row)?.tone ?? "slate",
      title: `Ended ${formatCalendarDay(project.endsOn)} — ${delivered >= 100 ? "target met" : `${delivered}% of the target delivered`}`,
      body: `${formatCount(row.deliveredPages)} of ${formatCount(project.targetPages)} pages digitized${
        short > 0 ? `, ${formatCount(short)} short` : ""
      }. These numbers stay true: the pages it funded are funded by it for good.`,
    };
  }

  const pace = paceOf(row);
  const daysLeft = `${plural(row.daysLeft, "day")} left.`;
  if (pace === null) {
    return {
      tone: "amber",
      title: `Running since ${formatCalendarDay(project.startsOn)}, and nothing is funded by it yet`,
      body: `${daysLeft} No approved request names this project.`,
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
