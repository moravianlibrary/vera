// What Users & Groups says (docs/demos/shared/page-access.js, vera-data.js `PERMISSIONS`): a line
// for each permission, how a role reaches a person, and how a responsibility does, with its
// provenance (permissions.md §6): "mapped by MZK Keycloak from group mzk-staff", "via Periodicals
// Curators".

import type { RoleWay, Via } from "@vera/domain/access";
import type { Watchlist } from "@vera/domain/entities";
import type { GrantScope, Permission } from "@vera/domain/permissions";
import { isStaticPermission } from "@vera/domain/permissions";
import { categoriesView } from "@/features/categories/categories-view";
import { documentsView, myDocumentsView } from "@/features/documents/documents-view";
import { intentionsView } from "@/features/intentions/intentions-board-view";
import { mixesView } from "@/features/intentions/mixes-view";
import { listsView } from "@/features/lists/lists-view";
import { projectsView } from "@/features/projects/projects-view";
import { requestsView } from "@/features/requests/requests-view";
import { tasksView } from "@/features/tasks/tasks-view";
import { validationsView } from "@/features/validations/validations-view";
import { i18n } from "@/i18n";
import type { FilterFieldDefinition, ViewDefinition } from "@/lib/view-definition";
import { isRangeField } from "@/lib/view-definition";

// The line each permission reads as, from the access messages in the language in use. A
// component that shows one calls useTranslation, so it says it again when the language changes.
export function permissionLineOf(permission: Permission, propertyName?: string): string {
  if (isStaticPermission(permission)) {
    return i18n.t(`permission.${permission}.line`);
  }

  // PERM-property-edit: a property's own permission reads as what it lets one enter.
  return propertyName === undefined
    ? i18n.t("permission.property_edit.line")
    : i18n.t("permission.property_edit.line_named", { name: propertyName });
}

// A self-scoped grant reads "own": it acts on the holder's own records and has no scope to choose.
export function scopeLabelOf(scope: GrantScope): string {
  return scope ?? i18n.t("scope.own", { ns: "access" });
}

export type NameOf = (id: string) => string;

// "by hand", "mapped", "by hand and mapped".
export function waysShortText(ways: readonly RoleWay[]): string {
  const hasHand = ways.some((way) => way.by === "hand");
  const hasMapped = ways.some((way) => way.by === "mapped");
  if (!hasHand && !hasMapped) return "";
  if (hasHand && hasMapped) return i18n.t("way.both", { ns: "access" });
  return i18n.t(`way.${hasHand ? "hand" : "mapped"}`, { ns: "access" });
}

// "member", "via Periodicals Curators".
export function viaText(via: Via, groupNameOf: NameOf, direct = "member"): string {
  return via === null
    ? i18n.t(direct === "member" ? "via.member" : "via.direct", { ns: "access" })
    : i18n.t("via.group", { ns: "access", name: groupNameOf(via) });
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
      ? i18n.t("conferred.categoryCustody", {
          ns: "access",
          names: joinAnd(categoryNames),
        })
      : null,
    custodyNames.length > 0
      ? i18n.t("conferred.proposalCustody", {
          ns: "access",
          count: custodyNames.length,
          names: joinAnd(custodyNames),
        })
      : null,
    projectNames.length > 0
      ? i18n.t("conferred.projects", { ns: "access", names: joinAnd(projectNames) })
      : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? i18n.t("conferred.empty", { ns: "access" }) : parts.join(", ");
}

function joinAnd(names: readonly string[]): string {
  if (names.length < 2) return names.join("");
  if (names.length === 2)
    return i18n.t("conferred.twoNames", { ns: "access", first: names[0], second: names[1] });
  return i18n.t("conferred.manyNames", {
    ns: "access",
    first: names.slice(0, -1).join(", "),
    last: names[names.length - 1],
  });
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
    case "requests":
      return summaryIn(requestsView, params);
    case "validations":
      return summaryIn(validationsView, params);
    case "lists":
      return summaryIn(listsView, params);
    case "projects":
      return summaryIn(projectsView, params);
    case "categories":
      return summaryIn(categoriesView, params);
    case "mixes":
      return summaryIn(mixesView, params);
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
