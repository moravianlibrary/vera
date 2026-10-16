// The Intentions board's filter, as a URL writes it: what a link opens and what a watchlist on
// Intentions saves.

import {
  anyProjectFundingFilterValue,
  intentionStates,
  noProjectFundingFilterValue,
} from "@vera/domain/intentions";
import type { DayRange, ValueRange } from "@vera/domain/value-range";
import {
  formatDayRange,
  formatRange,
  parseCount,
  parseDayRange,
  parseRange,
} from "@vera/domain/value-range";

export const intentionKinds = ["Target", "Output", "Repeat"] as const;
export type IntentionKind = (typeof intentionKinds)[number];
export const intentionBoardStates = [...intentionStates, "Archived"] as const;
export const intentionPaces = [
  "OutOfBand",
  "behindPace",
  "short",
  "onPace",
  "fullyPlanned",
  "targetMet",
  "NoPace",
] as const;
export const repeatIntervals = ["week", "month", "quarter"] as const;
export type BoardState = (typeof intentionBoardStates)[number];
export type Pace = (typeof intentionPaces)[number];
export type RepeatInterval = (typeof repeatIntervals)[number];
export interface IntentionsQuery {
  readonly search?: string;
  readonly kinds?: readonly IntentionKind[];
  readonly states?: readonly BoardState[];
  readonly paces?: readonly Pace[];
  readonly intervals?: readonly RepeatInterval[];
  readonly mixes?: readonly string[];
  readonly projects?: readonly string[];
  readonly starts?: DayRange;
  readonly ends?: DayRange;
  readonly planned?: ValueRange<number>;
  readonly delivered?: ValueRange<number>;
  readonly timeElapsed?: ValueRange<number>;
}

const paramsOf = {
  kinds: "type",
  states: "state",
  paces: "pace",
  intervals: "every",
  mixes: "mix",
  projects: "project",
  starts: "starts",
  ends: "ends",
  planned: "planned",
  delivered: "delivered",
  timeElapsed: "elapsed",
} as const;
const valuesOf = <Value extends string>(
  params: URLSearchParams,
  key: string,
  values: readonly Value[],
): Value[] | undefined => {
  const picked = (params.get(key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is Value => values.includes(value as Value));
  return picked.length > 0 ? [...new Set(picked)] : undefined;
};
const idsOf = (params: URLSearchParams, key: string): string[] | undefined => {
  const picked = (params.get(key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return picked.length > 0 ? [...new Set(picked)] : undefined;
};
export function parseIntentionsSearchParams(params: URLSearchParams): IntentionsQuery {
  return {
    search: params.get("q")?.trim() || undefined,
    kinds: valuesOf(params, paramsOf.kinds, intentionKinds),
    states: valuesOf(params, paramsOf.states, intentionBoardStates),
    paces: valuesOf(params, paramsOf.paces, intentionPaces),
    intervals: valuesOf(params, paramsOf.intervals, repeatIntervals),
    mixes: idsOf(params, paramsOf.mixes),
    projects:
      idsOf(params, paramsOf.projects) ??
      (params.get("funding") === "none"
        ? [noProjectFundingFilterValue]
        : params.get("funding") === "project"
          ? [anyProjectFundingFilterValue]
          : undefined),
    starts: parseDayRange(params.get(paramsOf.starts)),
    ends: parseDayRange(params.get(paramsOf.ends)),
    planned: parseRange(params.get(paramsOf.planned), parseCount),
    delivered: parseRange(params.get(paramsOf.delivered), parseCount),
    timeElapsed: parseRange(params.get(paramsOf.timeElapsed), parseCount),
  };
}

export function toIntentionsSearchParams(query: IntentionsQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set("q", query.search.trim());
  for (const key of ["kinds", "states", "paces", "intervals", "mixes", "projects"] as const) {
    if (query[key]?.length) params.set(paramsOf[key], query[key].join(","));
  }
  for (const key of ["starts", "ends"] as const) {
    const range = formatDayRange(query[key]);
    if (range !== null) params.set(paramsOf[key], range);
  }
  for (const key of ["planned", "delivered", "timeElapsed"] as const) {
    const range = formatRange(query[key]);
    if (range !== null) params.set(paramsOf[key], range);
  }
  return params;
}

export function isSameIntentionsQuery(first: IntentionsQuery, second: IntentionsQuery): boolean {
  const canonical = (query: IntentionsQuery) =>
    toIntentionsSearchParams({
      ...query,
      kinds: query.kinds?.toSorted(),
      states: query.states?.toSorted(),
      paces: query.paces?.toSorted(),
      intervals: query.intervals?.toSorted(),
      mixes: query.mixes?.toSorted(),
      projects: query.projects?.toSorted(),
    }).toString();
  return canonical(first) === canonical(second);
}
