// Users management's URL filter vocabulary. The page uses four entity views and keeps
// search and filters in the URL. The older selection and linked-column helpers remain below
// for compatibility while other access editors migrate; the page itself opens without a
// selected record and does not display shared watchlists.
// TODO(rrandiak): labels move to i18n.

import type { AccessIndex } from "@vera/contract/access";
import type { AccessRecordKind } from "@vera/contract/routes";
import { accessRecordKinds } from "@vera/contract/routes";
import type { AccessUser } from "@vera/domain/access";
import { heldRoleIdsOf } from "@vera/domain/access";
import type { Facets } from "@/components/filters/filter-bar";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const userShows = ["person", "agent", "none"] as const;
export type UserShow = (typeof userShows)[number];

export const userShowLabels = {
  person: "People",
  agent: "Agents",
  none: "No role yet",
} as const satisfies Record<UserShow, string>;

export interface AccessQuery {
  readonly search?: string;
  readonly show?: readonly UserShow[];
  readonly roleIds?: readonly string[];
  readonly groupIds?: readonly string[];
  readonly projectIds?: readonly string[];
  readonly custodyIds?: readonly string[];
  readonly pluginIds?: readonly string[];
  readonly categoryIds?: readonly string[];
  readonly sources?: readonly ("direct" | "group" | "none")[];
}

const searchParam = "q";
const showParam = "show";

function parseAccessSearchParams(params: URLSearchParams): AccessQuery {
  const list = (name: string) => {
    const values = (params.get(name) ?? "").split(",").filter(Boolean);
    return values.length === 0 ? undefined : [...new Set(values)];
  };
  const show = (params.get(showParam) ?? "")
    .split(",")
    .filter((value): value is UserShow => (userShows as readonly string[]).includes(value));
  return {
    search: params.get(searchParam)?.trim() || undefined,
    show: show.length === 0 ? undefined : [...new Set(show)],
    roleIds: list("role"),
    groupIds: list("group"),
    projectIds: list("project"),
    custodyIds: list("custody"),
    pluginIds: list("plugin"),
    categoryIds: list("categoryCustody"),
    sources: list("source")?.filter((value): value is "direct" | "group" | "none" =>
      ["direct", "group", "none"].includes(value),
    ),
  };
}

function toAccessSearchParams(query: AccessQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(searchParam, search);
  }

  if (query.show !== undefined && query.show.length > 0) {
    params.set(showParam, query.show.toSorted().join(","));
  }

  for (const [key, name] of [
    ["roleIds", "role"],
    ["groupIds", "group"],
    ["projectIds", "project"],
    ["custodyIds", "custody"],
    ["pluginIds", "plugin"],
    ["categoryIds", "categoryCustody"],
    ["sources", "source"],
  ] as const) {
    const values = query[key];
    if (values !== undefined && values.length > 0) params.set(name, values.toSorted().join(","));
  }

  return params;
}

export const accessView: ViewDefinition<AccessQuery> = {
  toSearchParams: toAccessSearchParams,
  parseSearchParams: parseAccessSearchParams,
  isSameQuery: (first, second) =>
    toAccessSearchParams(first).toString() === toAccessSearchParams(second).toString(),
  fields: [
    { key: "show", label: "Show", field: vocabulary(userShows, userShowLabels), isQuick: true },
  ],
  groupings: [],
  groupingParam: "group",
};

// ---------------------------------------------------------------- the selected record

// The records the page selects: those it changes, and the shared watchlists beside them.
export const accessSelectionKinds = [...accessRecordKinds, "watchlists"] as const;
export type AccessSelectionKind = AccessRecordKind | "watchlists";

export const selectionParams = {
  users: "u",
  roles: "r",
  groups: "g",
  custodies: "c",
  watchlists: "w",
} as const satisfies Record<AccessSelectionKind, string>;

export interface AccessSelection {
  kind: AccessSelectionKind;
  id: string;
}

// The record the URL names, if it exists; else the first user.
export function selectionOf(params: URLSearchParams, index: AccessIndex): AccessSelection | null {
  const exists: Record<AccessSelectionKind, (id: string) => boolean> = {
    users: (id) => index.users.some((user) => user.id === id),
    roles: (id) => index.roles.some((role) => role.id === id),
    groups: (id) => index.groups.some((group) => group.id === id),
    custodies: (id) => index.custodies.some((custody) => custody.id === id),
    watchlists: (id) => index.sharedWatchlists.some((watchlist) => watchlist.id === id),
  };
  for (const kind of accessSelectionKinds) {
    const id = params.get(selectionParams[kind]);
    if (id !== null && exists[kind](id)) {
      return { kind, id };
    }
  }

  const first = index.users[0];
  return first === undefined ? null : { kind: "users", id: first.id };
}

// ---------------------------------------------------------------- what the columns show

function matches(search: string | undefined, ...texts: readonly (string | null)[]): boolean {
  const needle = search?.trim().toLowerCase();
  return (
    needle === undefined ||
    needle === "" ||
    texts.some((text) => text?.toLowerCase().includes(needle))
  );
}

function showOf(user: AccessUser): UserShow[] {
  return [user.kind, ...(heldRoleIdsOf(user).length === 0 ? ["none" as const] : [])];
}

export function filteredIndex(index: AccessIndex, query: AccessQuery): AccessIndex {
  const shows = query.show ?? [];
  return {
    ...index,
    users: index.users.filter(
      (user) =>
        matches(query.search, user.name, user.email) &&
        (shows.length === 0 || showOf(user).some((show) => shows.includes(show))),
    ),
    roles: index.roles.filter((role) => matches(query.search, role.name)),
    groups: index.groups.filter((group) => matches(query.search, group.name)),
    custodies: index.custodies.filter((custody) => matches(query.search, custody.name)),
    sharedWatchlists: index.sharedWatchlists.filter((watchlist) =>
      matches(query.search, watchlist.name),
    ),
  };
}

// How many users each *Show* would find, over the search.
export function showFacetsOf(index: AccessIndex, query: AccessQuery): Facets {
  const searched = index.users.filter((user) => matches(query.search, user.name, user.email));
  return {
    show: userShows.map((show) => ({
      value: show,
      count: searched.filter((user) => showOf(user).includes(show)).length,
    })),
  };
}
