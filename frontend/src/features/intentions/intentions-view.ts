// Words and chart presentation for intention cards. The board's filtering and ordering live in
// intentions-board-view.ts.
// TODO(rrandiak): labels move to i18n.

import type { IntentionRow, MixRowView } from "@/api/intentions";
import type { Tone } from "@/components/status-badge";
import type { Intention, RepeatEvery } from "@/domain/entities";
import type { TargetVerdict } from "@/domain/intentions";
import { mixBand } from "@/domain/intentions";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

export const intentionColumns = ["target", "track"] as const;
export type IntentionColumn = (typeof intentionColumns)[number];

export const columnTitles = {
  target: "Targets",
  track: "Output",
} as const satisfies Record<IntentionColumn, string>;

export const columnOf = (intention: Pick<Intention, "targetPages">): IntentionColumn =>
  intention.targetPages === null ? "track" : "target";

export const everyLabels = {
  week: "Weekly",
  month: "Monthly",
  quarter: "Quarterly",
} as const satisfies Record<RepeatEvery, string>;

export const periodNouns = {
  week: "week",
  month: "month",
  quarter: "quarter",
} as const satisfies Record<RepeatEvery, string>;

// ---------------------------------------------------------------- words

const verdictTones = {
  onPace: "green",
  behindPace: "amber",
  targetMet: "green",
  short: "amber",
  fullyPlanned: "blue",
} as const satisfies Record<TargetVerdict, Tone>;

// The Projects wording: on pace, behind pace, target met; and an ended one met or short.
export function verdictBadgeOf(row: IntentionRow): { text: string; tone: Tone } | null {
  if (row.verdict === null) {
    return null;
  }

  const shortBy = (row.intention.targetPages ?? 0) - row.deliveredPages;
  const isEnded = row.state === "Ended";
  const labels = {
    onPace: "On pace",
    behindPace: "Behind pace",
    targetMet: isEnded ? "Ended — target met" : "Target met",
    short: `Ended — ${formatCount(shortBy)} pp short`,
    fullyPlanned: "Fully planned",
  } as const satisfies Record<TargetVerdict, string>;
  return { text: labels[row.verdict], tone: verdictTones[row.verdict] };
}

export function windowTextOf(row: Pick<IntentionRow, "intention" | "state">): string {
  const { intention } = row;
  const from = formatCalendarDay(intention.countsFrom);
  if (intention.isOverall) {
    return `Counting since ${from} · everything, no end`;
  }

  if (intention.endsOn !== null) {
    return `${from} → ${formatCalendarDay(intention.endsOn)}`;
  }

  return row.state === "Upcoming"
    ? `Counts from ${from} · no end`
    : `Counting since ${from} · no end`;
}

// Short, for a row in a fold or on a project.
export function shortWindowOf(intention: Pick<Intention, "countsFrom" | "endsOn">): string {
  return intention.endsOn === null
    ? `since ${formatCalendarDay(intention.countsFrom)}`
    : `${formatCalendarDay(intention.countsFrom)} → ${formatCalendarDay(intention.endsOn)}`;
}

export function metaOf(row: IntentionRow): string {
  const target = row.intention.targetPages;
  return target === null
    ? windowTextOf(row)
    : `${windowTextOf(row)} · target ${formatCount(target)} pp`;
}

export const scopePathOf = (path: readonly string[]) => path.join(" / ");

export function timeLabelOf(row: IntentionRow): string {
  switch (row.state) {
    case "Upcoming":
      return `starts in ${plural(row.daysToStart, "day")}`;
    case "Ended":
      return `ended ${formatCalendarDay(row.intention.endsOn ?? row.intention.countsFrom)}`;
    case "Running":
      return `${Math.round((row.timeElapsed ?? 0) * 100)}% · ${plural(row.daysLeft ?? 0, "day")} left`;
  }
}

// What the strip under a card calls the mix it reads.
export function mixLabelOf(row: IntentionRow): string {
  if (row.mix === null) return "No mix";
  return row.mix.name;
}

export function mixSourceOf(row: IntentionRow): string {
  if (row.mix === null) return "no mix selected";
  return row.intention.mixRevision == null
    ? "follows latest"
    : `revision ${row.intention.mixRevision} snapshot`;
}

// What a tracking card's mix is measured on.
export function outputBasisOf(row: IntentionRow): string | null {
  const { intention } = row;
  if (row.outputPages > 0) {
    return null;
  }

  return row.state === "Upcoming"
    ? `Counts from ${formatCalendarDay(intention.countsFrom)} — no output yet`
    : "No output yet — nothing matching has been digitized in its window";
}

export function outputSinceOf(row: IntentionRow): string {
  const { intention } = row;
  return intention.endsOn === null
    ? `Output since ${formatCalendarDay(intention.countsFrom)}`
    : `Output ${formatCalendarDay(intention.countsFrom)} → ${formatCalendarDay(intention.endsOn)}`;
}

// The category furthest from its share.
export function worstDriftOf(rows: readonly MixRowView[]): MixRowView | null {
  return (
    rows
      .filter((row) => row.drift !== null)
      .toSorted((first, second) => Math.abs(second.drift ?? 0) - Math.abs(first.drift ?? 0))[0] ??
    null
  );
}

export const signedPoints = (points: number) => `${points > 0 ? "+" : ""}${Math.round(points)}`;

export const bandText = `±${mixBand}`;

const percentText = (value: number) => `${Math.round(value * 10) / 10}%`;

export function shareTextOf(share: number | null): string {
  if (share === null) {
    return "unallocated";
  }

  return share === 0 ? "excluded" : percentText(share);
}
