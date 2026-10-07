// Users & Groups' state in its URL (docs/demos/shared/page-access.js; view-catalog.md): the
// search and *Show* (people, agents, or those with no role yet) narrow the columns, and one of
// `?u=`, `?r=`, `?g=` or `?c=` names the selected record. Opened bare, the first user is selected.
// The page holds every record already, so the filter is applied here, not by the server. No
// watchlists: people and roles are looked up, not watched.
// TODO(rrandiak): labels move to i18n.

import type { AccessIndex } from "@/api/access";
import type { AccessRecordKind } from "@/api/routes";
import { accessRecordKinds } from "@/api/routes";
import type { Facets } from "@/components/filters/filter-bar";
import type { AccessUser } from "@/domain/access";
import { heldRoleIdsOf } from "@/domain/access";
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
}

const searchParam = "q";
const showParam = "show";

function parseAccessSearchParams(params: URLSearchParams): AccessQuery {
  const show = (params.get(showParam) ?? "")
    .split(",")
    .filter((value): value is UserShow => (userShows as readonly string[]).includes(value));
  return {
    search: params.get(searchParam)?.trim() || undefined,
    show: show.length === 0 ? undefined : [...new Set(show)],
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

export const selectionParams = {
  users: "u",
  roles: "r",
  groups: "g",
  custodies: "c",
} as const satisfies Record<AccessRecordKind, string>;

export interface AccessSelection {
  kind: AccessRecordKind;
  id: string;
}

// The record the URL names, if it exists; else the first user.
export function selectionOf(params: URLSearchParams, index: AccessIndex): AccessSelection | null {
  const exists: Record<AccessRecordKind, (id: string) => boolean> = {
    users: (id) => index.users.some((user) => user.id === id),
    roles: (id) => index.roles.some((role) => role.id === id),
    groups: (id) => index.groups.some((group) => group.id === id),
    custodies: (id) => index.custodies.some((custody) => custody.id === id),
  };
  for (const kind of accessRecordKinds) {
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
