// Words and chart presentation for intention cards. The board's filtering and ordering live in
// intentions-board-view.ts.
import type { IntentionRow, MixRowView } from "@vera/contract/intentions";
import type { Intention, RepeatEvery } from "@vera/domain/entities";
import type { TargetVerdict } from "@vera/domain/intentions";
import { mixBand } from "@vera/domain/intentions";
import type { Tone } from "@/components/status-badge";
import { i18n } from "@/i18n";
import { formatCalendarDay, formatLongCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";

export const intentionColumns = ["target", "track"] as const;
export type IntentionColumn = (typeof intentionColumns)[number];

export const columnTitles = {
  target: "intentions:column.targets",
  track: "intentions:column.output",
} as const satisfies Record<IntentionColumn, string>;

export const columnOf = (intention: Pick<Intention, "targetPages">): IntentionColumn =>
  intention.targetPages === null ? "track" : "target";

export const everyLabels = {
  week: "intentions:repeat.weekly",
  month: "intentions:repeat.monthly",
  quarter: "intentions:repeat.quarterly",
} as const satisfies Record<RepeatEvery, string>;

export const periodNouns = {
  week: "intentions:period.week",
  month: "intentions:period.month",
  quarter: "intentions:period.quarter",
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
    onPace: i18n.t("intentions:verdict.onPace"),
    behindPace: i18n.t("intentions:verdict.behindPace"),
    targetMet: i18n.t(
      isEnded ? "intentions:verdict.endedTargetMet" : "intentions:verdict.targetMet",
    ),
    short: i18n.t("intentions:verdict.short", { count: shortBy }),
    fullyPlanned: i18n.t("intentions:verdict.fullyPlanned"),
  } satisfies Record<TargetVerdict, string>;
  return { text: labels[row.verdict], tone: verdictTones[row.verdict] };
}

export function windowTextOf(row: Pick<IntentionRow, "intention" | "state">): string {
  const { intention } = row;
  const from = formatCalendarDay(intention.countsFrom);
  if (intention.isOverall) {
    return i18n.t("intentions:window.overall", {
      from: formatCalendarDay(intention.countsFrom),
    });
  }

  if (intention.endsOn !== null) {
    return `${from} → ${formatCalendarDay(intention.endsOn)}`;
  }

  return row.state === "Upcoming"
    ? i18n.t("intentions:window.upcoming", { from: formatCalendarDay(intention.countsFrom) })
    : i18n.t("intentions:window.running", { from: formatCalendarDay(intention.countsFrom) });
}

// Short, for a row in a fold or on a project.
export function shortWindowOf(intention: Pick<Intention, "countsFrom" | "endsOn">): string {
  return intention.endsOn === null
    ? i18n.t("intentions:window.since", { from: formatCalendarDay(intention.countsFrom) })
    : `${formatCalendarDay(intention.countsFrom)} → ${formatCalendarDay(intention.endsOn)}`;
}

export function metaOf(row: IntentionRow): string {
  const target = row.intention.targetPages;
  return target === null
    ? windowTextOf(row)
    : i18n.t("intentions:meta.target", { window: windowTextOf(row), count: formatCount(target) });
}

export const scopePathOf = (path: readonly string[]) => path.join(" / ");

export function timeLabelOf(row: IntentionRow): string {
  switch (row.state) {
    case "Upcoming":
      return i18n.t("intentions:time.startsIn", { count: row.daysToStart });
    case "Ended":
      return i18n.t("intentions:time.ended", {
        date: formatCalendarDay(row.intention.endsOn ?? row.intention.countsFrom),
      });
    case "Running":
      return i18n.t("intentions:time.running", {
        percent: Math.round((row.timeElapsed ?? 0) * 100),
        count: row.daysLeft ?? 0,
      });
  }
}

// What the strip under a card calls the mix it reads.
export function mixLabelOf(row: IntentionRow): string {
  if (row.mix === null) return i18n.t("intentions:mix.none");
  return row.mix.name;
}

export function mixSourceOf(row: IntentionRow): string {
  if (row.mix === null) return i18n.t("intentions:mix.notSelected");
  return row.intention.mixRevision == null
    ? i18n.t("intentions:mix.latest")
    : i18n.t("intentions:mix.revision", { revision: row.intention.mixRevision });
}

// What a tracking card's mix is measured on.
export function outputBasisOf(row: IntentionRow): string | null {
  const { intention } = row;
  if (row.outputPages > 0) {
    return null;
  }

  return row.state === "Upcoming"
    ? i18n.t("intentions:output.upcoming", { from: formatLongCalendarDay(intention.countsFrom) })
    : i18n.t("intentions:output.none");
}

export function outputSinceOf(row: IntentionRow): string {
  const { intention } = row;
  return intention.endsOn === null
    ? i18n.t("intentions:output.since", { from: formatLongCalendarDay(intention.countsFrom) })
    : i18n.t("intentions:output.window", {
        from: formatCalendarDay(intention.countsFrom),
        to: formatCalendarDay(intention.endsOn),
      });
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
    return i18n.t("intentions:share.unallocated");
  }

  return share === 0 ? i18n.t("intentions:share.excluded") : percentText(share);
}
