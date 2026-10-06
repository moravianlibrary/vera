// The Digitization Lists view's declaration (component-interfaces.md §9.2): a search and *Show*,
// which reads Planned and running by default, with Done and Everything behind it (decided
// 2026-09-26, STATUS.md *Digitization Lists*). Show is one choice, not a field of values, so it
// sits beside the search rather than on the bar; the API filters by any set of states. No
// watchlists and no grouping: a handful of lists needs neither.
// TODO(rrandiak): labels move to i18n.

import type { ListQuery } from "@/api/lists";
import type { ListState } from "@/domain/lists";
import type { ViewDefinition } from "@/lib/view-definition";

export const listShows = ["current", "done", "all"] as const;
export type ListShow = (typeof listShows)[number];

export const listShowLabels = {
  current: "Planned and running",
  done: "Done",
  all: "Everything",
} as const satisfies Record<ListShow, string>;

const statesShown = {
  current: ["Planned", "InProgress"],
  done: ["Done"],
  all: undefined,
} as const satisfies Record<ListShow, readonly ListState[] | undefined>;

export interface ListsViewQuery {
  readonly search?: string;
  readonly show: ListShow;
}

const showParam = "show";
const searchParam = "q";

export function listQueryOf(query: ListsViewQuery): ListQuery {
  return { search: query.search, states: statesShown[query.show] };
}

function toSearchParams(query: ListsViewQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(searchParam, search);
  }

  if (query.show !== "current") {
    params.set(showParam, query.show);
  }

  return params;
}

// An unknown Show reads as the default, so a stale link still opens the view.
function parseSearchParams(params: URLSearchParams): ListsViewQuery {
  const show = listShows.find((value) => value === params.get(showParam)) ?? "current";
  return { search: params.get(searchParam)?.trim() || undefined, show };
}

export const listsView: ViewDefinition<ListsViewQuery> = {
  toSearchParams,
  parseSearchParams,
  isSameQuery: (first, second) =>
    toSearchParams(first).toString() === toSearchParams(second).toString(),
  fields: [],
  groupings: [],
  groupingParam: "group",
};

// ---------------------------------------------------------------- generating from an intention

// What a new list opens with when an intention's card starts it (intentions.md §4.4):
// `/lists/new?generate&shape=i8&pages=3000&alloc=c21:1650,c22:1350`. The Generate dialog opens
// at once, shaped by that intention, with the pages; a correcting run's allocation fixes them.
export interface GenerationStart {
  readonly intentionId: string | null;
  readonly pages: number | null;
  // Pages per category the intention's mix is read across.
  readonly allocation: Readonly<Record<string, number>> | null;
}

export function generationHrefOf(start: GenerationStart): string {
  const params = [
    "generate",
    start.intentionId === null ? null : `shape=${encodeURIComponent(start.intentionId)}`,
    start.pages === null ? null : `pages=${start.pages}`,
    start.allocation === null
      ? null
      : `alloc=${Object.entries(start.allocation)
          .map(([categoryId, pages]) => `${encodeURIComponent(categoryId)}:${pages}`)
          .join(",")}`,
  ].filter((param) => param !== null);
  return `/lists/new?${params.join("&")}`;
}

// Null without `generate`.
export function generationStartOf(params: URLSearchParams): GenerationStart | null {
  if (!params.has("generate")) {
    return null;
  }

  const pages = Number.parseInt(params.get("pages") ?? "", 10);
  const allocation = (params.get("alloc") ?? "")
    .split(",")
    .map((part) => part.split(":"))
    .filter(([categoryId, value]) => categoryId !== "" && /^\d+$/.test(value ?? ""));
  return {
    intentionId: params.get("shape"),
    pages: Number.isNaN(pages) || pages <= 0 ? null : pages,
    allocation:
      allocation.length === 0
        ? null
        : Object.fromEntries(allocation.map(([categoryId, value]) => [categoryId, Number(value)])),
  };
}
