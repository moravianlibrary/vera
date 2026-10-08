// The Digitization Lists view's searchable filter and saved watchlists. Runs means the calendar
// interval from a list's start through its end; a requested interval matches when they overlap.
// TODO(rrandiak): labels move to i18n.

import type { ListQuery } from "@/api/lists";
import {
  isSameListQuery,
  listAttentions,
  parseListSearchParams,
  toListSearchParams,
} from "@/api/lists";
import { listStates } from "@/domain/lists";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const listsView: ViewDefinition<ListQuery> = {
  view: "lists",
  toSearchParams: toListSearchParams,
  parseSearchParams: parseListSearchParams,
  isSameQuery: isSameListQuery,
  fields: [
    {
      key: "states",
      label: "State",
      field: vocabulary(listStates, {
        Planned: "Planned",
        InProgress: "In progress",
        Done: "Done",
      }),
      isQuick: true,
    },
    {
      key: "attention",
      label: "Needs attention",
      field: vocabulary(listAttentions, {
        Overdue: "Overdue",
        Blocked: "Blocked members",
        ReviewNeeded: "Review needed",
        LateCopy: "Late copy",
        Empty: "Empty",
      }),
    },
    { key: "runs", label: "Runs", field: { kind: "dateRange", presets: [] } },
  ],
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
