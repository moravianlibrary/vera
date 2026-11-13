import type { Category } from "@vera/domain/entities";
import type { ValueRange } from "@vera/domain/value-range";
import { formatRange, isWithinRange, parseCount, parseRange } from "@vera/domain/value-range";
import type { MixRecord } from "./mix-catalog";

export const mixStates = ["Active", "Archived"] as const;
export const mixPrimaries = ["Primary", "Other"] as const;
export const mixProportions = ["Complete", "Unallocated"] as const;
export type MixState = (typeof mixStates)[number];
export type MixPrimary = (typeof mixPrimaries)[number];
export type MixProportions = (typeof mixProportions)[number];

export interface MixQuery {
  readonly search?: string;
  readonly states?: readonly MixState[];
  readonly primaries?: readonly MixPrimary[];
  readonly proportions?: readonly MixProportions[];
  readonly intentions?: ValueRange<number>;
}

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

export function parseMixSearchParams(params: URLSearchParams): MixQuery {
  return {
    search: params.get("q")?.trim() || undefined,
    states: valuesOf(params, "state", mixStates),
    primaries: valuesOf(params, "primary", mixPrimaries),
    proportions: valuesOf(params, "proportions", mixProportions),
    intentions: parseRange(params.get("intentions"), parseCount),
  };
}

export function toMixSearchParams(query: MixQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set("q", query.search.trim());
  if (query.states?.length) params.set("state", query.states.join(","));
  if (query.primaries?.length) params.set("primary", query.primaries.join(","));
  if (query.proportions?.length) params.set("proportions", query.proportions.join(","));
  const intentions = formatRange(query.intentions);
  if (intentions !== null) params.set("intentions", intentions);
  return params;
}

export function isSameMixQuery(first: MixQuery, second: MixQuery): boolean {
  const canonical = (query: MixQuery) =>
    toMixSearchParams({
      ...query,
      states: query.states?.toSorted(),
      primaries: query.primaries?.toSorted(),
      proportions: query.proportions?.toSorted(),
    }).toString();
  return canonical(first) === canonical(second);
}

export function hasUnallocatedProportions(
  mix: Pick<MixRecord, "shares">,
  categories: readonly Category[],
): boolean {
  const totals = new Map<string | null, number>();
  for (const category of categories) {
    totals.set(
      category.parentId,
      (totals.get(category.parentId) ?? 0) + (mix.shares[category.id] ?? 0),
    );
  }
  return [...totals.values()].some((total) => total < 100);
}

export function matchingMixes(
  mixes: readonly MixRecord[],
  categories: readonly Category[],
  query: MixQuery,
): MixRecord[] {
  const search = query.search?.toLocaleLowerCase();
  return mixes.filter(
    (mix) =>
      (!search ||
        Object.values(mix.names).some((name) => name?.toLocaleLowerCase().includes(search))) &&
      (!query.states?.length ||
        query.states.includes(mix.archivedAt === null ? "Active" : "Archived")) &&
      (!query.primaries?.length || query.primaries.includes(mix.isPrimary ? "Primary" : "Other")) &&
      (!query.proportions?.length ||
        query.proportions.includes(
          hasUnallocatedProportions(mix, categories) ? "Unallocated" : "Complete",
        )) &&
      (query.intentions === undefined || isWithinRange(mix.usageCount, query.intentions)),
  );
}
