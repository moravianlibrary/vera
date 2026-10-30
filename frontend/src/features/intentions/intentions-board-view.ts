import type {
  BoardState,
  IntentionKind,
  IntentionsQuery,
  Pace,
} from "@vera/contract/intention-filters";
import {
  intentionBoardStates,
  intentionKinds,
  intentionPaces,
  isSameIntentionsQuery,
  parseIntentionsSearchParams,
  repeatIntervals,
  toIntentionsSearchParams,
} from "@vera/contract/intention-filters";
import type { IntentionIndex, IntentionRow, IntentionTemplateRow } from "@vera/contract/intentions";
import {
  anyProjectFundingFilterValue,
  noMixFilterValue,
  noProjectFundingFilterValue,
} from "@vera/domain/intentions";
import type { DayRange, ValueRange } from "@vera/domain/value-range";
import { isReversedRange, isWithinRange, resolveDayRange } from "@vera/domain/value-range";
import { type ViewDefinition, vocabulary } from "@/lib/view-definition";

export const intentionsView: ViewDefinition<IntentionsQuery> = {
  view: "intentions",
  parseSearchParams: parseIntentionsSearchParams,
  toSearchParams: toIntentionsSearchParams,
  isSameQuery: isSameIntentionsQuery,
  fields: [
    {
      key: "kinds",
      label: "intentions:filter.type",
      field: vocabulary(intentionKinds, {
        Target: "intentions:kind.targets",
        Output: "intentions:kind.output",
        Repeat: "intentions:kind.repeats",
      }),
      isQuick: true,
    },
    {
      key: "states",
      label: "intentions:filter.state",
      field: vocabulary(intentionBoardStates, {
        Running: "intentions:state.running",
        Upcoming: "intentions:state.upcoming",
        Ended: "intentions:state.ended",
        Archived: "intentions:state.archived",
      }),
      isQuick: true,
    },
    {
      key: "paces",
      label: "intentions:filter.pace",
      field: vocabulary(intentionPaces, {
        OutOfBand: "intentions:pace.outOfBand",
        onPace: "intentions:verdict.onPace",
        behindPace: "intentions:verdict.behindPace",
        targetMet: "intentions:verdict.targetMet",
        short: "intentions:pace.endedShort",
        fullyPlanned: "intentions:verdict.fullyPlanned",
        NoPace: "intentions:pace.none",
      }),
      isQuick: true,
    },
    {
      key: "intervals",
      label: "intentions:filter.repeatEvery",
      field: vocabulary(repeatIntervals, {
        week: "intentions:repeat.weekly",
        month: "intentions:repeat.monthly",
        quarter: "intentions:repeat.quarterly",
      }),
    },
    {
      key: "mixes",
      label: "intentions:filter.mix",
      field: { kind: "reference", reference: "mixes" },
    },
    {
      key: "projects",
      label: "intentions:filter.project",
      field: { kind: "reference", reference: "projects" },
    },
    { key: "starts", label: "intentions:filter.countingStart", field: { kind: "dateRange" } },
    { key: "ends", label: "intentions:filter.countingEnd", field: { kind: "dateRange" } },
    {
      key: "planned",
      label: "intentions:filter.planned",
      field: { kind: "numberRange", unit: "intentions:unit.percentTarget" },
    },
    {
      key: "delivered",
      label: "intentions:filter.delivered",
      field: { kind: "numberRange", unit: "intentions:unit.percentTarget" },
    },
    {
      key: "timeElapsed",
      label: "intentions:filter.timeElapsed",
      field: { kind: "numberRange", unit: "intentions:unit.percent" },
    },
  ],
  groupings: [],
  groupingParam: "group",
};

const matchesSearch = (text: string, search: string | undefined) =>
  search === undefined || text.toLocaleLowerCase().includes(search.toLocaleLowerCase());
const picked = (selected: readonly string[] | undefined, value: string | null) =>
  selected === undefined || (value !== null && selected.includes(value));
const pickedAny = (selected: readonly string[] | undefined, values: readonly string[]) =>
  selected === undefined || values.some((value) => selected.includes(value));
const fundingProjectOf = (funding: { kind: string; projectId?: string }) =>
  funding.kind === "project" ? (funding.projectId ?? null) : null;
const matchesProject = (
  selected: readonly string[] | undefined,
  funding: { kind: string; projectId?: string },
  ownProjectId: string | null,
) =>
  selected === undefined ||
  selected.some((value) =>
    value === noProjectFundingFilterValue
      ? funding.kind === "none"
      : value === anyProjectFundingFilterValue
        ? funding.kind === "project"
        : value === (ownProjectId ?? fundingProjectOf(funding)),
  );
const matchDay = (value: string | null, range: DayRange | undefined, today: Date) => {
  if (range === undefined) return true;
  if (value === null) return false;
  const resolved = resolveDayRange(range, today);
  return !isReversedRange(resolved) && isWithinRange(value, resolved);
};
const matchPercent = (value: number | null, range: ValueRange<number> | undefined) =>
  range === undefined || (value !== null && !isReversedRange(range) && isWithinRange(value, range));
const percentOf = (pages: number, target: number | null) =>
  target === null ? null : Math.round((pages / target) * 100);
const paceValuesOf = (row: IntentionRow): Pace[] => {
  const values: Pace[] = [];
  if (row.outOfBandCount > 0) values.push("OutOfBand");
  if (row.verdict !== null) values.push(row.verdict);
  if (values.length === 0) values.push("NoPace");
  return values;
};
const stateOf = (row: IntentionRow): BoardState =>
  row.intention.archived === null ? row.state : "Archived";
export function intentionKindOf(row: IntentionRow): IntentionKind {
  return row.intention.targetPages === null ? "Output" : "Target";
}
export function matchingIntentions(index: IntentionIndex, query: IntentionsQuery): IntentionIndex {
  const today = index.asOf === undefined ? new Date() : new Date(`${index.asOf}T12:00:00`);
  return {
    asOf: index.asOf,
    rows: index.rows.filter(
      (row) =>
        picked(query.kinds, intentionKindOf(row)) &&
        matchesSearch(`${row.intention.name} ${row.intention.description}`, query.search) &&
        picked(query.states, stateOf(row)) &&
        pickedAny(query.paces, paceValuesOf(row)) &&
        query.intervals === undefined &&
        picked(query.mixes, row.intention.distributionId ?? noMixFilterValue) &&
        matchesProject(query.projects, row.intention.funding, row.intention.projectId) &&
        matchDay(row.intention.countsFrom, query.starts, today) &&
        matchDay(row.intention.endsOn, query.ends, today) &&
        matchPercent(percentOf(row.plannedPages, row.intention.targetPages), query.planned) &&
        matchPercent(percentOf(row.deliveredPages, row.intention.targetPages), query.delivered) &&
        matchPercent(
          row.timeElapsed === null ? null : Math.round(row.timeElapsed * 100),
          query.timeElapsed,
        ),
    ),
    templates: index.templates.filter(
      (row) =>
        picked(query.kinds, "Repeat") &&
        matchesSearch(row.template.namePattern, query.search) &&
        query.states === undefined &&
        query.paces === undefined &&
        picked(query.intervals, row.template.every) &&
        picked(query.mixes, row.template.distributionId ?? noMixFilterValue) &&
        matchesProject(query.projects, row.template.funding, null) &&
        matchDay(row.template.since, query.starts, today) &&
        query.ends === undefined &&
        query.planned === undefined &&
        query.delivered === undefined &&
        query.timeElapsed === undefined,
    ),
  };
}

export function intentionFacets(index: IntentionIndex, query: IntentionsQuery) {
  const candidates = <Key extends keyof IntentionsQuery>(key: Key) =>
    matchingIntentions(index, { ...query, [key]: undefined });
  const count = (
    values: readonly string[],
    selected: keyof IntentionsQuery,
    of: (index: IntentionIndex, value: string) => number,
  ) => values.map((value) => ({ value, count: of(candidates(selected), value) }));
  const rows = (index: IntentionIndex, predicate: (row: IntentionRow) => boolean) =>
    index.rows.filter(predicate).length;
  return {
    kinds: count(intentionKinds, "kinds", (matching, value) =>
      value === "Repeat"
        ? matching.templates.length
        : rows(matching, (row) => intentionKindOf(row) === value),
    ),
    states: count(intentionBoardStates, "states", (matching, value) =>
      rows(matching, (row) => stateOf(row) === value),
    ),
    paces: count(intentionPaces, "paces", (matching, value) =>
      rows(matching, (row) => paceValuesOf(row).includes(value as Pace)),
    ),
    intervals: count(
      repeatIntervals,
      "intervals",
      (matching, value) => matching.templates.filter((row) => row.template.every === value).length,
    ),
    mixes: count(
      [
        ...new Set([
          noMixFilterValue,
          ...index.rows
            .map((row) => row.intention.distributionId)
            .filter((id): id is string => id !== null),
          ...index.templates
            .map((row) => row.template.distributionId)
            .filter((id): id is string => id !== null),
        ]),
      ],
      "mixes",
      (matching, value) =>
        rows(matching, (row) => (row.intention.distributionId ?? noMixFilterValue) === value) +
        matching.templates.filter(
          (row) => (row.template.distributionId ?? noMixFilterValue) === value,
        ).length,
    ),
    projects: count(
      [
        ...new Set(
          [
            noProjectFundingFilterValue,
            anyProjectFundingFilterValue,
            ...index.rows.map(
              (row) => row.intention.projectId ?? fundingProjectOf(row.intention.funding),
            ),
            ...index.templates.map((row) => fundingProjectOf(row.template.funding)),
          ].filter((id): id is string => id !== null),
        ),
      ],
      "projects",
      (matching, value) =>
        rows(matching, (row) =>
          matchesProject([value], row.intention.funding, row.intention.projectId),
        ) +
        matching.templates.filter((row) => matchesProject([value], row.template.funding, null))
          .length,
    ),
  };
}

export interface IntentionBoardSections {
  repeats: IntentionTemplateRow[];
  running: IntentionRow[];
  upcoming: IntentionRow[];
  ended: IntentionRow[];
  archived: IntentionRow[];
}

const attentionRank = (row: IntentionRow) => {
  if (row.outOfBandCount > 0) return 0;
  switch (row.verdict) {
    case "behindPace":
    case "short":
      return 1;
    case "onPace":
      return 2;
    case "fullyPlanned":
      return 3;
    case "targetMet":
      return 4;
    default:
      return 5;
  }
};

export function compareIntentionCards(first: IntentionRow, second: IntentionRow): number {
  return (
    attentionRank(first) - attentionRank(second) ||
    (first.intention.endsOn ?? "9999-12-31").localeCompare(
      second.intention.endsOn ?? "9999-12-31",
    ) ||
    (second.intention.targetPages ?? 0) - (first.intention.targetPages ?? 0) ||
    first.intention.name.localeCompare(second.intention.name) ||
    first.intention.id.localeCompare(second.intention.id)
  );
}

export function intentionBoardSectionsOf(index: IntentionIndex): IntentionBoardSections {
  const rows = index.rows;
  return {
    repeats: index.templates.toSorted((a, b) => a.template.nextOn.localeCompare(b.template.nextOn)),
    running: rows
      .filter((row) => row.intention.archived === null && row.state === "Running")
      .toSorted(compareIntentionCards),
    upcoming: rows
      .filter((row) => row.intention.archived === null && row.state === "Upcoming")
      .toSorted(compareIntentionCards),
    ended: rows
      .filter((row) => row.intention.archived === null && row.state === "Ended")
      .toSorted(compareIntentionCards),
    archived: rows.filter((row) => row.intention.archived !== null).toSorted(compareIntentionCards),
  };
}
