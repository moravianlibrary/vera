// A list view's state, kept in its URL so that any state is a link (component-interfaces.md
// §9.1): the filter in the view's own parameters, the open record (`?id=` or the view's own
// name for it), the grouping and `?watchlist=`, the tab the filter was opened from. Every change
// replaces the history entry, so Back leaves the view rather than stepping through its filters.

import type { Watchlist } from "@vera/domain/entities";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useTier } from "@/hooks/use-tier";
import type { ViewDefinition } from "@/lib/view-definition";
import { parseGrouping } from "@/lib/view-definition";

const watchlistParam = "watchlist";

type Filter = Watchlist["filter"];

export interface ViewUrlState<Query, Grouping extends string> {
  query: Query;
  // The filter in its URL form, as a watchlist saves it.
  filter: Filter;
  // Keeps the open record, the grouping and the tab. Null detaches the tab; a watchlist id
  // names the tab the filter now comes from.
  setQuery: (query: Query, openedWatchlistId?: string | null) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  grouping: Grouping | null;
  setGrouping: (grouping: Grouping | null) => void;
  watchlistId: string | null;
  // Opens a tab: its filter replaces the current one; null opens "All".
  openWatchlist: (watchlist: Watchlist | null) => void;
  // The open tab is gone; the filter stays as it is.
  detachWatchlist: () => void;
  // Nothing named but perhaps the grouping, so the remembered tab may open.
  isBare: boolean;
  // Bumped when a tab replaces the filter, so the bar drops its typed search.
  filterReplacements: number;
}

export function useViewUrlState<Query, Grouping extends string>(
  definition: ViewDefinition<Query, Grouping>,
  selectedParam = "id",
): ViewUrlState<Query, Grouping> {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const tier = useTier();
  const [filterReplacements, setFilterReplacements] = useState(0);
  const query = definition.parseSearchParams(params);
  // What the view keeps of its URL when the filter changes.
  const keptParams = [selectedParam, definition.groupingParam, watchlistParam];

  const replaceParams = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace: true });
  };

  const setParam = (name: string, value: string | null) =>
    replaceParams((next) => (value === null ? next.delete(name) : next.set(name, value)));

  const select = (id: string | null) => {
    if (tier !== "phone") {
      setParam(selectedParam, id);
      return;
    }
    if (id === null) {
      if ((location.state as { openedRecord?: boolean } | null)?.openedRecord) {
        navigate(-1);
      } else {
        setParam(selectedParam, null);
      }
      return;
    }
    const next = new URLSearchParams(params);
    next.set(selectedParam, id);
    if (params.get(selectedParam) === null) {
      setParams(next, { state: { openedRecord: true } });
    } else {
      setParams(next, { replace: true, state: location.state });
    }
  };

  const setQuery = (nextQuery: Query, openedWatchlistId?: string | null) => {
    const next = definition.toSearchParams(nextQuery);
    for (const name of keptParams) {
      const value = params.get(name);
      if (value !== null) {
        next.set(name, value);
      }
    }

    if (openedWatchlistId === null) {
      next.delete(watchlistParam);
    } else if (openedWatchlistId !== undefined) {
      next.set(watchlistParam, openedWatchlistId);
    }

    setParams(next, { replace: true });
  };

  const openWatchlist = (watchlist: Watchlist | null) => {
    const filter = watchlist === null ? {} : watchlist.filter;
    setQuery(definition.parseSearchParams(new URLSearchParams(filter)), watchlist?.id ?? null);
    setFilterReplacements((count) => count + 1);
  };

  return {
    query,
    filter: Object.fromEntries(definition.toSearchParams(query)),
    setQuery,
    selectedId: params.get(selectedParam),
    select,
    grouping: parseGrouping(definition, params),
    setGrouping: (grouping) => setParam(definition.groupingParam, grouping),
    watchlistId: params.get(watchlistParam),
    openWatchlist,
    detachWatchlist: () => setQuery(query, null),
    isBare: [...params.keys()].every((name) => name === definition.groupingParam),
    filterReplacements,
  };
}
