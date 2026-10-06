// How the Intentions page arranges what the server counted (docs/demos/shared/page-intentions.js;
// STATUS "Intentions"): two columns of cards, Targets (a page target) and Tracking (only the
// mix), derived, never stored. Each runs running → upcoming, with Ended and Archived folded below;
// running targets with an end come first by their end, then open-ended ones by how far along
// they are; Overall heads Tracking. A column's tile counts intentions, never pages, since pages
// of different intentions overlap. `?i=` opens and marks one card, `?t=` one repeat, and `?col=`
// picks the column where only one fits.
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
  track: "Tracking",
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

// ---------------------------------------------------------------- URL

export interface IntentionsUrlState {
  // The card to open and mark.
  focusedId: string | null;
  // The repeat to mark.
  focusedTemplateId: string | null;
  column: IntentionColumn;
}

export function intentionsUrlStateOf(
  params: URLSearchParams,
  rows: readonly IntentionRow[],
): IntentionsUrlState {
  const focusedId = params.get("i");
  const focused = rows.find((row) => row.intention.id === focusedId);
  return {
    focusedId: focused === undefined ? null : focused.intention.id,
    focusedTemplateId: params.get("t"),
    // A focused card shows its own column.
    column:
      focused !== undefined
        ? columnOf(focused.intention)
        : params.get("col") === "track"
          ? "track"
          : "target",
  };
}

// ---------------------------------------------------------------- sections

export interface ColumnSections {
  running: IntentionRow[];
  upcoming: IntentionRow[];
  ended: IntentionRow[];
  archived: IntentionRow[];
}

const deliveredShare = (row: IntentionRow) =>
  row.deliveredPages / Math.max(1, row.intention.targetPages ?? 1);

export function columnSectionsOf(
  rows: readonly IntentionRow[],
  column: IntentionColumn,
): ColumnSections {
  const inColumn = rows.filter((row) => columnOf(row.intention) === column);
  const live = inColumn.filter((row) => row.intention.archived === null);
  const running = live.filter((row) => row.state === "Running");
  const dated = running
    .filter((row) => row.intention.endsOn !== null)
    .toSorted((first, second) =>
      (first.intention.endsOn ?? "").localeCompare(second.intention.endsOn ?? ""),
    );
  const open = running
    .filter((row) => row.intention.endsOn === null)
    .toSorted((first, second) => deliveredShare(second) - deliveredShare(first));
  return {
    running:
      column === "target"
        ? [...dated, ...open]
        : running.toSorted(
            (first, second) =>
              Number(second.intention.isOverall) - Number(first.intention.isOverall) ||
              first.intention.name.localeCompare(second.intention.name),
          ),
    upcoming: live
      .filter((row) => row.state === "Upcoming")
      .toSorted((first, second) =>
        first.intention.countsFrom.localeCompare(second.intention.countsFrom),
      ),
    ended: live
      .filter((row) => row.state === "Ended")
      .toSorted((first, second) =>
        (second.intention.endsOn ?? "").localeCompare(first.intention.endsOn ?? ""),
      ),
    archived: inColumn
      .filter((row) => row.intention.archived !== null)
      .toSorted((first, second) =>
        (second.intention.archived?.at ?? "").localeCompare(first.intention.archived?.at ?? ""),
      ),
  };
}

export interface TilePart {
  key: string;
  count: number | null;
  label: string;
  isAlert?: boolean;
}

// Intentions, never pages: "4 running · 1 upcoming · 1 behind pace".
export function tileOf(sections: ColumnSections, column: IntentionColumn): TilePart[] {
  const current = [...sections.running, ...sections.upcoming];
  const verdicts = new Map<string, number>();
  for (const row of current) {
    const badge = verdictBadgeOf(row);
    if (badge !== null) {
      verdicts.set(badge.text, (verdicts.get(badge.text) ?? 0) + 1);
    }
  }

  const outOfBand = sections.running.filter((row) => row.outOfBandCount > 0).length;
  return [
    { key: "running", count: sections.running.length, label: "running" },
    ...(sections.upcoming.length > 0
      ? [{ key: "upcoming", count: sections.upcoming.length, label: "upcoming" }]
      : []),
    ...[...verdicts].map(([text, count]) => ({ key: text, count, label: text.toLowerCase() })),
    ...(column === "track"
      ? [
          outOfBand > 0
            ? { key: "band", count: outOfBand, label: "out of band", isAlert: true }
            : { key: "band", count: null, label: "all in band" },
        ]
      : []),
  ];
}

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
  if (row.scope !== null) {
    return `Mix within ${row.scope.path.at(-1)}`;
  }

  if (!row.mix.isOwn) {
    return `${row.mix.owner.name}'s mix`;
  }

  return row.intention.isOverall ? row.intention.name : "Own mix";
}

export function mixSourceOf(row: IntentionRow): string {
  if (!row.mix.isOwn) {
    return `tracks ${row.mix.owner.name}`;
  }

  return row.mix.trackerCount > 0
    ? `own · tracked by ${row.mix.trackerCount}`
    : "own · used only here";
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
