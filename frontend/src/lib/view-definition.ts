// What a list view declares once, so the parts that read its state agree on it: how its filter
// is written in the URL, when two filters are the same (the watchlist comparer) and how its rows
// may be grouped (frontend/component-interfaces.md §9.2). The URL hook, the watchlist tabs and
// the list read it; the filter bar's fields join it with the filter bar.

import type { WatchlistView } from "@/domain/entities";

export interface ViewGroupingOption<Grouping extends string> {
  readonly value: Grouping;
  readonly label: string;
}

export interface ViewDefinition<Query, Grouping extends string = never> {
  readonly view: WatchlistView;
  readonly toSearchParams: (query: Query) => URLSearchParams;
  // Unknown or malformed values are dropped, so a stale link still opens the view.
  readonly parseSearchParams: (params: URLSearchParams) => Query;
  readonly isSameQuery: (first: Query, second: Query) => boolean;
  // Every grouping the view knows; a page offers those the caller may use. Grouping is
  // presentation, never part of the filter or of a watchlist (filtering.md §3.4).
  readonly groupings: readonly ViewGroupingOption<Grouping>[];
  readonly groupingParam: string;
}

// The grouping the URL names, or null when it names none the view knows.
export function parseGrouping<Grouping extends string>(
  definition: Pick<ViewDefinition<unknown, Grouping>, "groupings" | "groupingParam">,
  params: URLSearchParams,
): Grouping | null {
  const raw = params.get(definition.groupingParam);
  return definition.groupings.find((option) => option.value === raw)?.value ?? null;
}
