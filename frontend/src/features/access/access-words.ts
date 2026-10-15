// What Users & Groups says (docs/demos/shared/page-access.js, vera-data.js `PERMISSIONS`): a line
// for each permission, how a role reaches a person, and how a responsibility does, with its
// provenance (permissions.md §6): "mapped by MZK Keycloak from group mzk-staff", "via Periodicals
// Curators".
// TODO(rrandiak): labels move to i18n.

import type { RoleWay, Via } from "@/domain/access";
import type { Watchlist } from "@/domain/entities";
import type { GrantScope, Permission } from "@/domain/permissions";
import { categoriesView } from "@/features/categories/categories-view";
import { documentsView, myDocumentsView } from "@/features/documents/documents-view";
import { intentionsView } from "@/features/intentions/intentions-board-view";
import { tasksView } from "@/features/tasks/tasks-view";
import { listsView } from "@/features/lists/lists-view";
import { projectsView } from "@/features/projects/projects-view";
import { proposalsView } from "@/features/proposals/proposals-view";
import { validationsView } from "@/features/validations/validations-view";
import type { FilterFieldDefinition, ViewDefinition } from "@/lib/view-definition";
import { isRangeField } from "@/lib/view-definition";

export const permissionLines = {
  "request.create": "raise a proposal",
  "request.read_own": "my requests and what they became",
  "request.withdraw_own": "take back my own ask",
  "request.read": "other people's requests",
  "request.decide": "approve or decline a proposal, rescans included; custody is proposal custody",
  "iteration.read": "other people's documents",
  "iteration.recheck": "read the record from the catalog again and rerun the checks",
  "iteration.classify": "category and priority, after approval",
  "validation.approve": "accept the outstanding defects",
  "validation.deny": "refuse, with a reason",
  "validation.revoke": "take an approval back",
  "restriction.overrule": "lift a restriction; never custody",
  "iteration.cancel": "stop work, with a reason",
  "iteration.resume": "restart stopped work",
  "iteration.publish": "set the link where the scan is available",
  "request.read_ingest": "ingest detail: batch, failure text",
  "request.retry": "ingest again",
  "request.read_payload": "raw responses",
  "list.read": "see digitization lists",
  "list.create": "build a list, generators included",
  "list.edit": "membership and dates",
  "list.delete": "return a list's members to the pool",
  "intention.read": "see intentions",
  "intention.edit": "create and edit intentions, and their mix",
  "mix.read": "see mixes and their revisions",
  "mix.edit": "create mixes and edit their proportions",
  "mix.manage": "archive mixes and choose the Primary mix",
  "intention.repeat": "repeating intentions",
  "project.read": "see projects",
  "project.create": "start a project; it starts Proposed",
  "project.edit": "edit a project",
  "project.manage_members": "who is on a project, and its manager",
  "project.decide": "approve or reject a project, and see every project",
  "project.delete": "delete a project with no proposals",
  "category.read": "see the tree",
  "category.edit": "rename, move, refine",
  "category.grant_custody": "bring somebody onto a branch",
  watch: "save watchlists over what I can read",
  "watchlist.manage_system": "create, change and remove system watchlists, and set who sees them",
  "task.read_own": "the tasks I started, and cancelling them",
  "task.read": "everybody's tasks, and Schedules",
  "task.cancel": "cancel somebody else's run",
  "task.schedule": "edit schedules and retention",
  "plugin.read": "see plugins",
  "plugin.configure": "configure instances",
  "plugin.upload_code": "install plugin code",
  "plugin.run": "run a plugin now",
  "hook.read": "see hooks",
  "hook.configure": "edit hooks",
  "access.read": "see users, groups and roles",
  "access.manage": "change them, roles included",
} as const satisfies Record<Permission, string>;

// A self-scoped grant reads "own": it acts on the holder's own records and has no scope to choose.
export function scopeLabelOf(scope: GrantScope): string {
  return scope ?? "own";
}

export type NameOf = (id: string) => string;

// "by hand", "mapped", "by hand and mapped".
export function waysShortText(ways: readonly RoleWay[]): string {
  return [...new Set(ways.map((way) => (way.by === "hand" ? "by hand" : "mapped")))].join(" and ");
}

// "member", "via Periodicals Curators".
export function viaText(via: Via, groupNameOf: NameOf, direct = "member"): string {
  return via === null ? direct : `via ${groupNameOf(via)}`;
}

// What adding somebody to a group gives them: never a role.
export function confersText({
  categoryNames,
  custodyNames,
  projectNames,
}: {
  categoryNames: readonly string[];
  custodyNames: readonly string[];
  projectNames: readonly string[];
}): string {
  const parts = [
    categoryNames.length > 0
      ? `custody of ${joinAnd(categoryNames)} and everything under it`
      : null,
    custodyNames.length > 0
      ? `the proposal ${custodyNames.length === 1 ? "custody" : "custodies"} ${joinAnd(custodyNames)}`
      : null,
    projectNames.length > 0 ? `membership of ${joinAnd(projectNames)}` : null,
  ].filter((part) => part !== null);
  return parts.length === 0
    ? "nothing yet: the group holds no custody and no project"
    : parts.join(", ");
}

function joinAnd(names: readonly string[]): string {
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// A watchlist's filter in its view's own words: "Decision: Pending · Material: Periodical".
// Names of records a field points at stay their ids here.
export function filterSummaryOf({ view, filter }: Pick<Watchlist, "view" | "filter">): string {
  const params = new URLSearchParams(filter);
  switch (view) {
    case "documents":
      return summaryIn(documentsView, params);
    case "my-documents":
      return summaryIn(myDocumentsView, params);
    case "proposals":
      return summaryIn(proposalsView, params);
    case "validations":
      return summaryIn(validationsView, params);
    case "lists":
      return summaryIn(listsView, params);
    case "projects":
      return summaryIn(projectsView, params);
    case "categories":
      return summaryIn(categoriesView, params);
    case "intentions":
      return summaryIn(intentionsView, params);
    case "tasks":
      return summaryIn(tasksView, params);
  }
}

function summaryIn<Query extends object, Grouping extends string>(
  definition: ViewDefinition<Query, Grouping>,
  params: URLSearchParams,
): string {
  const query = new Map<string, unknown>(Object.entries(definition.parseSearchParams(params)));
  const fieldText = (field: FilterFieldDefinition<Query>) => {
    const value = query.get(field.key);
    if (value === undefined) {
      return null;
    }

    if (isRangeField(field) || !Array.isArray(value)) {
      return `${field.label}: set`;
    }

    const labels: Readonly<Record<string, string>> =
      field.field.kind === "vocabulary" ? field.field.labels : {};
    return `${field.label}: ${value.map((item: string) => labels[item] ?? item).join(", ")}`;
  };
  const parts = [
    typeof query.get("search") === "string" ? `“${query.get("search")}”` : null,
    ...definition.fields.map(fieldText),
  ].filter((part) => part !== null);
  return parts.length === 0 ? "everything" : parts.join(" · ");
}
