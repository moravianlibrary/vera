// What the server does for Documents Validations: gather the current iterations a defect holds or
// a rule forbade, keep them to the caller's category custody (`validation.*` at `custody` reaches
// the categories under the ones they hold, at `any` every one), then search, filter, count and
// sort; and rule on them. Each verdict appends one row naming exactly the keys it covers
// (status-model.md §2), moves progress as the gates now say (flows.md V14) and writes the log.

import type {
  Acceptance,
  Denial,
  Revocation,
  ValidationDetail,
  ValidationGroup,
  ValidationGrouping,
  ValidationListField,
  ValidationPage,
  ValidationQuery,
  ValidationRangeField,
  VerdictResult,
} from "@/api/validations";
import { severalPlugins, validationPageSchema, validationSliceSize } from "@/api/validations";
import { categoryLineageOf } from "@/domain/categories";
import { followedIterationId } from "@/domain/documents";
import type { Iteration, Session, StatusLogEntry, ValidationVerdict } from "@/domain/entities";
import { priorities } from "@/domain/entities";
import { progressAfterGates, scopeOfIteration } from "@/domain/iterations";
import type { Permission } from "@/domain/permissions";
import { can } from "@/domain/permissions";
import { approvedKeysOf, outstandingDefects } from "@/domain/status";
import type { ValidationRow } from "@/domain/validations";
import { defectNameOf, defectsToRuleOn, reviewStateOf, waitingSinceOf } from "@/domain/validations";
import { isWithinRange, resolveDayRange } from "@/lib/value-range";
import type { Arrangement } from "@/mocks/arrangement";
import { countValues, groupedBy, sliceOf } from "@/mocks/arrangement";
import { catalogLinkOf } from "@/mocks/catalog";
import { database } from "@/mocks/database";
import { oncePerCause } from "@/mocks/documents";
import type { Outcome } from "@/mocks/mutations";
import { progressNote, replaceIteration, writeLog } from "@/mocks/mutations";
import { filterablePropertiesOf, propertyFacetsOf, propertyPredicatesOf } from "@/mocks/properties";
import { mockToday } from "@/mocks/today";

// ---------------------------------------------------------------- reach

// Any of them opens the view; each verdict checks its own.
const reviewPermissions = [
  "validation.approve",
  "validation.deny",
  "validation.revoke",
] as const satisfies readonly Permission[];

export function canReview(session: Session): boolean {
  return reviewPermissions.some((permission) => can(session, permission));
}

function isInCustody(session: Session, iteration: Iteration): boolean {
  const scope = scopeOfIteration(database.categories, iteration.categoryId);
  return reviewPermissions.some((permission) => can(session, permission, scope));
}

// A document's latest attempt: an earlier one is history, never reviewed again.
function isCurrentAttempt(iteration: Iteration): boolean {
  return !database.iterations.some(
    (other) => other.documentId === iteration.documentId && other.attempt > iteration.attempt,
  );
}

function rowOf(iteration: Iteration): ValidationRow | null {
  const review = reviewStateOf(iteration);
  const document = database.documents.find((candidate) => candidate.id === iteration.documentId);
  if (review === null || document === undefined || !isCurrentAttempt(iteration)) {
    return null;
  }

  const askerIds = database.requests
    .filter((request) => followedIterationId(request) === iteration.id)
    .map((request) => request.requesterId);
  return {
    iteration,
    document,
    review,
    waitingSince: waitingSinceOf(iteration),
    askerIds: [...new Set(askerIds)],
  };
}

function reachableRows(session: Session): ValidationRow[] {
  return database.iterations
    .filter((iteration) => isInCustody(session, iteration))
    .flatMap((iteration) => rowOf(iteration) ?? []);
}

// The row of an iteration held here within the caller's custody; null otherwise.
export function findReachableValidation(
  session: Session,
  iterationId: string,
): ValidationRow | null {
  const iteration = database.iterations.find((candidate) => candidate.id === iterationId);
  if (iteration === undefined || !isInCustody(session, iteration)) {
    return null;
  }

  return rowOf(iteration);
}

// ---------------------------------------------------------------- list

// A property's condition counts as its own field, `p.<key>`.
type FilterField = `p.${string}` | "search" | ValidationListField | ValidationRangeField;

interface Predicate {
  field: FilterField;
  matches: (row: ValidationRow) => boolean;
}

const listFields = [
  "reviews",
  "forbidden",
  "categoryIds",
  "plugins",
  "priorities",
  "projectIds",
] as const satisfies readonly ValidationListField[];

const fieldValues = {
  // A forbidden item has no review state here; the Forbidden field finds it.
  reviews: (row) => (row.review === "Forbidden" ? [] : [row.review]),
  forbidden: (row) => [row.review === "Forbidden" ? "Yes" : "No"],
  // A category holds every category above it too, so it matches its whole subtree.
  categoryIds: (row) => categoryLineageOf(database.categories, row.iteration.categoryId),
  plugins: (row) => [...new Set(defectsToRuleOn(row.iteration).map((defect) => defect.plugin))],
  priorities: (row) => [row.iteration.priority],
  projectIds: (row) => (row.iteration.projectId === null ? [] : [row.iteration.projectId]),
} as const satisfies Record<ValidationListField, (row: ValidationRow) => readonly string[]>;

export function queryValidations(
  session: Session,
  query: ValidationQuery,
  slice: { cursor: string | null; limit: number } = { cursor: null, limit: validationSliceSize },
  grouping: ValidationGrouping | null = null,
): ValidationPage {
  const reachable = reachableRows(session);
  // DOC-property-filter: the properties the page shows that the caller may read.
  const properties = filterablePropertiesOf(session, false);
  const subjectOf = (row: ValidationRow) => ({ document: row.document, iteration: row.iteration });
  const predicates = [
    ...predicatesOf(query),
    ...propertyPredicatesOf(query.properties, properties).map(
      ({ key, matches }): Predicate => ({
        field: `p.${key}`,
        matches: (row) => matches(subjectOf(row)),
      }),
    ),
  ];
  // A facet counts over every other filter, so picking a value never hides its siblings.
  const matchingAllBut = (field: FilterField | null) =>
    reachable.filter((row) =>
      predicates.every((predicate) => predicate.field === field || predicate.matches(row)),
    );

  const matching = matchingAllBut(null).toSorted(byUrgency);
  const arrangement = grouping === null ? null : arrangementOf(grouping, reachable);
  const arranged = arrangement === null ? matching : arrangement.sorted(matching);
  const { items, nextCursor } = sliceOf(arranged, (row) => row.iteration.id, slice);
  const countOf = (field: ValidationListField) =>
    countValues(matchingAllBut(field).flatMap(fieldValues[field]));

  return {
    items,
    total: matching.length,
    outstandingTotal: matching
      .filter((row) => row.review === "Needed")
      .reduce((sum, row) => sum + outstandingDefects(row.iteration).length, 0),
    nextCursor,
    groups: arrangement === null ? [] : arrangement.headersOf(items, matching),
    // Each list's values were produced by that field's own value function.
    facets: validationPageSchema.shape.facets.parse(
      Object.fromEntries(listFields.map((field) => [field, countOf(field)])),
    ),
    propertyFacets: propertyFacetsOf(properties, (key) =>
      matchingAllBut(`p.${key}`).map(subjectOf),
    ),
  };
}

export function findValidationDetail(
  session: Session,
  iterationId: string,
): ValidationDetail | null {
  const row = findReachableValidation(session, iterationId);
  if (row === null) {
    return null;
  }

  return { row, catalogLink: catalogLinkOf(row.document.catalogId), log: logOf(row) };
}

function predicatesOf(query: ValidationQuery): Predicate[] {
  const predicates: Predicate[] = [];
  const { search } = query;
  if (search !== undefined) {
    predicates.push({ field: "search", matches: (row) => matchesSearch(row, search) });
  }

  for (const field of listFields) {
    const wanted = query[field];
    if (wanted === undefined || wanted.length === 0) {
      continue;
    }

    const wantedValues = new Set<string>(wanted);
    predicates.push({
      field,
      matches: (row) => fieldValues[field](row).some((value) => wantedValues.has(value)),
    });
  }

  const { waiting } = query;
  if (waiting !== undefined) {
    predicates.push({
      field: "waiting",
      matches: (row) =>
        isWithinRange(row.waitingSince.slice(0, 10), resolveDayRange(waiting, mockToday)),
    });
  }

  return predicates;
}

// Title, identifiers, shelf mark and the defects; an iteration or document ID matches whole.
function matchesSearch(row: ValidationRow, search: string): boolean {
  const needle = search.toLowerCase();
  const { document, iteration } = row;
  const texts = [
    document.title,
    document.catalogId,
    document.unit?.value,
    document.shelfMark,
    ...iteration.defects.flatMap((defect) => [defectNameOf(defect), defect.subject]),
  ];
  const ids = [iteration.id, document.id].map((id) => id.toLowerCase());
  return texts.some((text) => text?.toLowerCase().includes(needle)) || ids.includes(needle);
}

// What needs review first, then the most urgent, then the longest waiting, then by title.
function byUrgency(first: ValidationRow, second: ValidationRow): number {
  const rankOf = (row: ValidationRow) => priorities.indexOf(row.iteration.priority);
  return (
    Number(first.review !== "Needed") - Number(second.review !== "Needed") ||
    rankOf(second) - rankOf(first) ||
    first.waitingSince.localeCompare(second.waitingSince) ||
    first.document.title.localeCompare(second.document.title)
  );
}

// ---------------------------------------------------------------- grouping

// By category in the tree's order; by defect, the plugins in name order, then the rows whose
// defects come from several, then those with none left to rule on. Within a group the list's own
// order holds.
function arrangementOf(
  grouping: ValidationGrouping,
  reachable: readonly ValidationRow[],
): Arrangement<ValidationRow, ValidationGroup> {
  if (grouping === "category") {
    return groupedBy(
      (row) => row.iteration.categoryId,
      database.categories.map((category) => category.id),
      (categoryId, total, rowCount) => ({
        kind: "category",
        categoryId: categoryId ?? "",
        total,
        rowCount,
      }),
    );
  }

  const plugins = [...new Set(reachable.flatMap(fieldValues.plugins))].toSorted();
  return groupedBy(defectGroupOf, [...plugins, severalPlugins], (plugin, total, rowCount) => ({
    kind: "defect",
    plugin,
    total,
    rowCount,
  }));
}

function defectGroupOf(row: ValidationRow): string | null {
  const plugins = fieldValues.plugins(row);
  if (row.review === "Forbidden" || row.review === "Approved" || plugins.length === 0) {
    return null;
  }

  return plugins.length === 1 ? (plugins[0] ?? null) : severalPlugins;
}

// The iteration's own story, newest first.
function logOf(row: ValidationRow): StatusLogEntry[] {
  return oncePerCause(
    database.statusLog
      .filter((entry) => entry.subjectId === row.iteration.id)
      .toSorted((first, second) => second.at.localeCompare(first.at)),
  );
}

// ---------------------------------------------------------------- verdicts

// A row held here that the caller may rule on with this permission. One outside their custody
// is not found: unlike a proposal, an iteration's category says whose it is.
function rowToRuleOn(
  session: Session,
  iterationId: string,
  permission: Permission,
): Outcome<ValidationRow> {
  const row = findReachableValidation(session, iterationId);
  if (row === null) {
    return { refusal: { status: 404, message: "Nothing here waits for a verdict" } };
  }

  const scope = scopeOfIteration(database.categories, row.iteration.categoryId);
  if (!can(session, permission, scope)) {
    return { refusal: { status: 403, message: "You may not give this verdict" } };
  }

  if (row.review === "Forbidden") {
    return {
      refusal: { status: 409, message: "A rule forbids it; only an administrator can lift it" },
    };
  }

  return { value: row };
}

// The keys must be what is outstanding now: a set that changed meanwhile is ruled on again.
function outstandingRefusal(row: ValidationRow, defectKeys: readonly string[]) {
  if (row.review !== "Needed") {
    return { status: 409 as const, message: "It is no longer waiting for review" };
  }

  const outstanding = new Set(outstandingDefects(row.iteration).map((defect) => defect.key));
  if (!defectKeys.every((key) => outstanding.has(key))) {
    return { status: 409 as const, message: "The defects have changed meanwhile" };
  }

  return null;
}

export function acceptDefects(
  session: Session,
  iterationId: string,
  acceptance: Acceptance,
): Outcome<VerdictResult> {
  const found = rowToRuleOn(session, iterationId, "validation.approve");
  if ("refusal" in found) {
    return found;
  }

  const row = found.value;
  const refusal = outstandingRefusal(row, acceptance.defectKeys);
  if (refusal !== null) {
    return { refusal };
  }

  return {
    value: appendVerdict(session, row, {
      defectKeys: acceptance.defectKeys,
      verdict: "Approved",
      note: acceptance.note ?? "",
      publicText: null,
    }),
  };
}

export function denyDefects(
  session: Session,
  iterationId: string,
  denial: Denial,
): Outcome<VerdictResult> {
  const found = rowToRuleOn(session, iterationId, "validation.deny");
  if ("refusal" in found) {
    return found;
  }

  const row = found.value;
  const refusal = outstandingRefusal(row, denial.defectKeys);
  if (refusal !== null) {
    return { refusal };
  }

  return {
    value: appendVerdict(session, row, {
      defectKeys: denial.defectKeys,
      verdict: "Denied",
      note: denial.internalText ?? "",
      publicText: denial.publicText,
    }),
  };
}

// Takes back acceptances still standing; they are outstanding again and it is back in review.
export function revokeAcceptance(
  session: Session,
  iterationId: string,
  revocation: Revocation,
): Outcome<VerdictResult> {
  const found = rowToRuleOn(session, iterationId, "validation.revoke");
  if ("refusal" in found) {
    return found;
  }

  const row = found.value;
  const accepted = approvedKeysOf(row.iteration);
  const current = new Set(row.iteration.defects.map((defect) => defect.key));
  const isStanding = (key: string) => accepted.has(key) && current.has(key);
  if (!revocation.defectKeys.every(isStanding)) {
    return { refusal: { status: 409, message: "Those defects are not accepted now" } };
  }

  return {
    value: appendVerdict(session, row, {
      defectKeys: revocation.defectKeys,
      verdict: "Revoked",
      note: "",
      publicText: null,
    }),
  };
}

const verdictEvents = {
  Approved: "Validation approved",
  Denied: "Validation denied",
  Revoked: "Validation revoked",
} as const satisfies Record<ValidationVerdict["verdict"], string>;

function appendVerdict(
  session: Session,
  row: ValidationRow,
  verdict: Omit<ValidationVerdict, "actorId" | "at">,
): VerdictResult {
  const now = new Date().toISOString();
  const ruled: Iteration = {
    ...row.iteration,
    verdicts: [...row.iteration.verdicts, { ...verdict, actorId: session.user.id, at: now }],
  };
  const progress = progressAfterGates(ruled);
  replaceIteration({ ...ruled, progress });

  const names = row.iteration.defects
    .filter((defect) => verdict.defectKeys.includes(defect.key))
    .map(defectNameOf)
    .join(", ");
  writeLog({
    subjectKind: "iteration",
    subjectId: row.iteration.id,
    at: now,
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: verdictEvents[verdict.verdict],
    detail: [
      verdict.note === "" ? names : `${names} — ${verdict.note}`,
      verdict.publicText === null ? null : `They were told: “${verdict.publicText}”`,
      progressNote(row.iteration.progress, progress),
    ]
      .filter((sentence) => sentence !== null)
      .join(" "),
  });

  return {
    iterationId: row.iteration.id,
    review: reviewStateOf(ruled),
    progress,
    askerCount: row.askerIds.length,
  };
}
