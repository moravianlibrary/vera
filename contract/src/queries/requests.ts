// Shared read queries for Requests, over the record store.

import type { Answer } from "@vera/contract/documents";
import type {
  AskerCount,
  RequestDetail,
  RequestGroup,
  RequestGrouping,
  RequestListField,
  RequestPage,
  RequestQuery,
  RequestRangeField,
} from "@vera/contract/requests";
import { requestPageSchema, requestSliceSize } from "@vera/contract/requests";
import type { Arrangement } from "@vera/domain/arrangement";
import { countValues, groupedBy, sliceOf } from "@vera/domain/arrangement";
import { servedBatchOf, shownBatchIdOf } from "@vera/domain/batches";
import { currentIterationOf, existingCopiesOf } from "@vera/domain/documents";
import type {
  Document,
  Request,
  RequestCustody,
  Session,
  StatusLogEntry,
} from "@vera/domain/entities";
import { oncePerCause } from "@vera/domain/events";
import { isWithinScope, scopesOf } from "@vera/domain/permissions";
import { scopeOfProject } from "@vera/domain/projects";
import type { StoredRequestCustody } from "@vera/domain/request-custody";
import type { ClassifierSuggestion, RequestRow } from "@vera/domain/requests";
import {
  askerIdsOf,
  asksOf,
  batchIdsOf,
  firstAskOf,
  isAfterProjectApproval,
  isBeingChecked,
  isBulkApprovable,
  isProposalDecision,
  isRescan,
  projectIdsOf,
  rowDecisionOf,
} from "@vera/domain/requests";
import type { RecordStore } from "@vera/domain/store";
import {
  iterationsByDocumentOf,
  requestsByDocumentOf,
  statusLogForSubjectsOf,
} from "@vera/domain/store-index";
import { isWithinRange, resolveDayRange } from "@vera/domain/value-range";
import {
  filterablePropertiesOf,
  mayReadStaffProperties,
  propertyFacetsOf,
  propertyPredicatesOf,
} from "./properties";

// The plugins a query asks (ACCESS-custody-by-plugins, the classifier's suggestion).
export interface RequestPlugins {
  // The custodies whose rules place this ask, before the fallback (custodiesOf applies it).
  placementsOf(request: Request, document: Document): readonly string[];
  suggestionFor(ask: Request, document: Document): ClassifierSuggestion | null;
}

function publicPropertiesOf(
  store: RecordStore,
  properties: readonly import("@vera/domain/properties").PropertyValues[],
) {
  const keys = new Set(
    store.propertyDefinitions
      .filter((definition) => definition.visibility === "public")
      .map(({ key }) => key),
  );
  return properties
    .filter(({ key }) => keys.has(key))
    .map((values) => ({
      ...values,
      sources: values.sources.map((source) => ({ ...source, setBy: null })),
    }));
}

// ---------------------------------------------------------------- reach

// Requests opens with `request.read`, and only `request.decide` decides; each reaches as far as
// its own scope (VIEW-requests, ACCESS-membership-not-capability).
export function canReadRequests(session: Session): boolean {
  return scopesOf(session, "request.read").length > 0;
}

export function canDecide(session: Session): boolean {
  return scopesOf(session, "request.decide").length > 0;
}

type RequestPermission = "request.read" | "request.decide";

// At `custody` a row is reached through one of its request custodies; at `project`, through a
// project one of its asks was made into (SCOPE-custody-request, SCOPE-project).
function isInReachOf(
  store: RecordStore,
  session: Session,
  permission: RequestPermission,
  row: RequestRow,
): boolean {
  return scopesOf(session, permission).some((scope) => {
    switch (scope) {
      case "any":
        return true;
      case "custody": {
        const memberOf = memberCustodyIdsOf(store, session);
        return row.custodyIds.some((custodyId) => memberOf.has(custodyId));
      }
      case "project":
        return projectIdsOf(row).some((projectId) => {
          const project = store.projects.find((candidate) => candidate.id === projectId);
          return (
            project !== undefined && isWithinScope(session, "project", scopeOfProject(project))
          );
        });
      default:
        return false;
    }
  });
}

// The custodies the caller is a member of, directly or through a group.
function memberCustodyIdsOf(store: RecordStore, session: Session): Set<string> {
  const userId = session.user.id;
  const groupIds = store.groups
    .filter((group) => group.memberIds.includes(userId))
    .map(({ id }) => id);
  return new Set(
    store.requestCustodies
      .filter(
        (custody) =>
          custody.memberIds.includes(userId) ||
          custody.groupIds.some((groupId) => groupIds.includes(groupId)),
      )
      .map(({ id }) => id),
  );
}

export function isDecidableBy(store: RecordStore, session: Session, row: RequestRow): boolean {
  return isInReachOf(store, session, "request.decide", row);
}

export function publicCustodyOf({
  memberIds: _memberIds,
  groupIds: _groupIds,
  ...custody
}: StoredRequestCustody): RequestCustody {
  return custody;
}

export function reachableRows(
  store: RecordStore,
  plugins: RequestPlugins,
  session: Session,
): RequestRow[] {
  return store.documents.flatMap((document) => {
    const row = rowOf(store, plugins, document);
    return row !== null && isInReachOf(store, session, "request.read", row) ? [row] : [];
  });
}

// The custodies the Custody rules place each open proposal in now, one entry per document since
// one decision covers every asker (proposal-custody.md §5, Users & Groups).
export function openProposalPlacements(store: RecordStore, plugins: RequestPlugins): string[][] {
  return openProposalRows(store, plugins).map((row) => row.custodyIds);
}

export function openProposalRows(store: RecordStore, plugins: RequestPlugins): RequestRow[] {
  return store.documents.flatMap((document) => {
    const row = rowOf(store, plugins, document);
    return row === null || row.decision !== "Pending" ? [] : [row];
  });
}

// The open or decided row of a document the caller decides; null outside their reach.
export function findReachableRow(
  store: RecordStore,
  plugins: RequestPlugins,
  session: Session,
  documentId: string,
): RequestRow | null {
  return (
    reachableRows(store, plugins, session).find((row) => row.record.document.id === documentId) ??
    null
  );
}

// The document's asks that share its liveliest proposal decision; null when it has none.
export function rowOf(
  store: RecordStore,
  plugins: RequestPlugins,
  document: Document,
): RequestRow | null {
  const proposals = (requestsByDocumentOf(store).get(document.id) ?? []).filter((request) =>
    isProposalDecision(request.decision),
  );
  const decision = rowDecisionOf(proposals);
  if (decision === null) {
    return null;
  }

  const asks = proposals
    .filter((request) => request.decision === decision)
    .toSorted(
      (first, second) => first.at.localeCompare(second.at) || first.id.localeCompare(second.id),
    );
  const iterations = (iterationsByDocumentOf(store).get(document.id) ?? []).toSorted(
    (first, second) => first.attempt - second.attempt,
  );
  return {
    record: { document, iterations, requests: asks },
    decision,
    custodyIds: custodiesOf(store, plugins, asks, document),
    suggestion: asks[0] === undefined ? null : plugins.suggestionFor(asks[0], document),
  };
}

// The union of the custodies whose rules matched each ask; the fallback when it is empty. A rule
// whose custody was deleted places nothing (ACCESS-custody-delete).
function custodiesOf(
  store: RecordStore,
  plugins: RequestPlugins,
  asks: readonly Request[],
  document: Document,
): string[] {
  const picked = new Set(asks.flatMap((request) => plugins.placementsOf(request, document)));
  const placed = store.requestCustodies.filter(
    (custody) => !custody.isFallback && picked.has(custody.id),
  );
  if (placed.length > 0) {
    return placed.map(({ id }) => id);
  }

  return store.requestCustodies.filter((custody) => custody.isFallback).map(({ id }) => id);
}

// Copies made for volume carry the fixture's ID with a `.n` suffix.
export function baseIdOf(requestId: string): string {
  return requestId.replace(/\.\d+$/, "");
}

// ---------------------------------------------------------------- list

// A property's condition counts as its own field, `p.<key>`.
type FilterField = `p.${string}` | "search" | RequestListField | RequestRangeField;

interface Predicate {
  field: FilterField;
  matches: (row: RequestRow) => boolean;
}

type FieldValues = Record<
  RequestListField,
  (store: RecordStore, row: RequestRow) => readonly string[]
>;

const listFields = [
  "decisions",
  "custodyIds",
  "documentTypes",
  "projectIds",
  "existingCopies",
  "askerIds",
  "batchIds",
  "sources",
  "askerCounts",
  "afterProjectApproval",
] as const satisfies readonly RequestListField[];

const fieldValues: FieldValues = {
  decisions: (_store, row) => [row.decision],
  custodyIds: (_store, row) => row.custodyIds,
  documentTypes: (_store, row) => [row.record.document.type],
  projectIds: (_store, row) => projectIdsOf(row),
  existingCopies: (_store, row) => {
    const copies = existingCopiesOf(asksOf(row));
    return copies.length === 0 ? ["None"] : [...new Set(copies.map((copy) => copy.state))];
  },
  askerIds: (_store, row) => askerIdsOf(row),
  batchIds: shownBatchIdsOf,
  sources: (store, row) =>
    batchIdsOf(row).flatMap((batchId) => {
      const source = store.batches.find((batch) => batch.id === batchId)?.source;
      return source === null || source === undefined ? [] : [source.instanceId];
    }),
  askerCounts: (_store, row) => [askerCountOf(row)],
  afterProjectApproval: (_store, row) => [answerOf(isAfterProjectApproval(row))],
};

// Only a batch shown as one can be filtered on (ENT-batch).
function shownBatchIdsOf(store: RecordStore, row: RequestRow): string[] {
  return batchIdsOf(row).flatMap((batchId) => shownBatchIdOf(store, batchId) ?? []);
}

function askerCountOf(row: RequestRow): AskerCount {
  return askerIdsOf(row).length > 1 ? "Several" : "One";
}

function answerOf(isTrue: boolean): Answer {
  return isTrue ? "Yes" : "No";
}

export function queryRequests(
  store: RecordStore,
  plugins: RequestPlugins,
  session: Session,
  query: RequestQuery,
  slice: { cursor: string | null; limit: number } = { cursor: null, limit: requestSliceSize },
  grouping: RequestGrouping | null = null,
): RequestPage {
  const reachable = reachableRows(store, plugins, session);
  // DOC-property-filter: the properties the page shows that the caller may read.
  const properties = filterablePropertiesOf(store, session, false)
    // The Type filter is its material type already.
    .filter((definition) => definition.key !== "material_type");
  const subjectOf = (row: RequestRow) => ({
    document: row.record.document,
    iteration: currentIterationOf(row.record),
  });
  const predicates = [
    ...predicatesOf(store, query),
    ...propertyPredicatesOf(store, query.properties, properties).map(
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

  const matching = matchingAllBut(null).toSorted(byDecisionThenAge);
  // A batch counts what the caller may approve of it: what their `request.decide` reaches.
  const decidable = reachable.filter((row) => isDecidableBy(store, session, row));
  const arrangement = arrangementOf(store, grouping, matching, decidable);
  const arranged = arrangement === null ? matching : arrangement.sorted(matching);
  const { items, nextCursor } = sliceOf(arranged, (row) => row.record.document.id, slice);
  const countOf = (field: RequestListField) =>
    countValues(matchingAllBut(field).flatMap((row) => fieldValues[field](store, row)));

  return {
    items,
    total: matching.length,
    askTotal: matching.reduce((sum, row) => sum + asksOf(row).length, 0),
    nextCursor,
    groups: arrangement === null ? [] : arrangement.headersOf(items, matching),
    // Each list's values were produced by that field's own value function.
    facets: requestPageSchema.shape.facets.parse(
      Object.fromEntries(listFields.map((field) => [field, countOf(field)])),
    ),
    propertyFacets: propertyFacetsOf(properties, (key) =>
      matchingAllBut(`p.${key}`).map(subjectOf),
    ),
  };
}

export function findRequestDetail(
  store: RecordStore,
  plugins: RequestPlugins,
  session: Session,
  documentId: string,
): RequestDetail | null {
  const row = findReachableRow(store, plugins, session, documentId);
  if (row === null) {
    return null;
  }

  return {
    row: mayReadStaffProperties(session) ? row : withPublicProperties(store, row),
    log: logOf(store, row),
    canDecide: row.decision === "Pending" && isDecidableBy(store, session, row),
  };
}

// DOC-property-visibility: staff properties are read with `iteration.read`, not on Requests alone.
function withPublicProperties(store: RecordStore, row: RequestRow): RequestRow {
  const { document, iterations } = row.record;
  return {
    ...row,
    record: {
      ...row.record,
      document: { ...document, properties: publicPropertiesOf(store, document.properties) },
      iterations: iterations.map((iteration) => ({
        ...iteration,
        properties: publicPropertiesOf(store, iteration.properties),
      })),
    },
  };
}

function predicatesOf(store: RecordStore, query: RequestQuery): Predicate[] {
  const predicates: Predicate[] = [];
  const { search } = query;
  if (search !== undefined) {
    predicates.push({ field: "search", matches: (row) => matchesSearch(store, row, search) });
  }

  for (const field of listFields) {
    const wanted = query[field];
    if (wanted === undefined || wanted.length === 0) {
      continue;
    }

    const wantedValues = new Set<string>(wanted);
    predicates.push({
      field,
      matches: (row) => fieldValues[field](store, row).some((value) => wantedValues.has(value)),
    });
  }

  // A row asked for on several days is in the range when any of its asks is.
  const { asked } = query;
  if (asked !== undefined) {
    predicates.push({
      field: "asked",
      matches: (row) =>
        asksOf(row).some((request) =>
          isWithinRange(request.at.slice(0, 10), resolveDayRange(asked, store.today)),
        ),
    });
  }

  return predicates;
}

// Title, identifiers, who asked and the batch; a request ID matches whole.
function matchesSearch(store: RecordStore, row: RequestRow, search: string): boolean {
  const needle = search.toLowerCase();
  const { document } = row.record;
  const askerNames = askerIdsOf(row).map(
    (userId) => store.users.find((user) => user.id === userId)?.name,
  );
  const texts = [
    document.title,
    document.catalogId,
    document.unit?.value,
    document.shelfMark,
    ...askerNames,
    ...batchIdsOf(row),
  ];
  const ids = asksOf(row).map((request) => request.id.toLowerCase());
  return texts.some((text) => text?.toLowerCase().includes(needle)) || ids.includes(needle);
}

// Open rows first, then the longest waiting, then by title.
function byDecisionThenAge(first: RequestRow, second: RequestRow): number {
  return (
    Number(first.decision !== "Pending") - Number(second.decision !== "Pending") ||
    (firstAskOf(first)?.at ?? "").localeCompare(firstAskOf(second)?.at ?? "") ||
    first.record.document.title.localeCompare(second.record.document.title)
  );
}

// ---------------------------------------------------------------- grouping

function arrangementOf(
  store: RecordStore,
  grouping: RequestGrouping | null,
  matching: readonly RequestRow[],
  decidable: readonly RequestRow[],
): Arrangement<RequestRow, RequestGroup> | null {
  if (grouping === "batch") {
    return batchArrangementOf(store, matching, decidable);
  }

  if (grouping === "requester") {
    return requesterArrangementOf(store, matching);
  }

  return null;
}

// A row is listed in the batch of its earliest ask. Batches come in the order their first rows
// wait, oldest first, and what was proposed on its own, a batch of one included, comes last
// (ENT-batch).
function batchArrangementOf(
  store: RecordStore,
  matching: readonly RequestRow[],
  decidable: readonly RequestRow[],
): Arrangement<RequestRow, RequestGroup> {
  const homeOf = (row: RequestRow) => shownBatchIdOf(store, firstAskOf(row)?.batchId ?? null);
  const order = [...new Set(matching.flatMap((row) => homeOf(row) ?? []))];
  const openInBatch = (batchId: string) =>
    decidable.filter((row) => row.decision === "Pending" && batchIdsOf(row).includes(batchId));

  return groupedBy(homeOf, order, (batchId, total, rowCount) => {
    const batch = batchId === null ? null : servedBatchOf(store, batchId);
    const asks = matching.flatMap((row) =>
      asksOf(row).filter((request) => request.batchId === batchId),
    );
    const elsewhere = matching.filter(
      (row) => homeOf(row) !== batchId && batchIdsOf(row).some((id) => id === batchId),
    );
    const open = batchId === null ? [] : openInBatch(batchId);
    return {
      kind: "batch",
      batch,
      askCount: batchId === null ? 0 : asks.length,
      elsewhereCount: batchId === null ? 0 : elsewhere.length,
      approvableCount: open.filter(isBulkApprovable).length,
      suggestedCounts: countValues(
        open.flatMap((row) =>
          isBulkApprovable(row) && row.suggestion !== null ? [row.suggestion.categoryId] : [],
        ),
      ),
      rescanCount: open.filter(isRescan).length,
      checkingCount: open.filter((row) => !isRescan(row) && isBeingChecked(row)).length,
      total,
      rowCount,
    };
  });
}

// A row is listed under whoever asked first; the busiest requesters come first.
function requesterArrangementOf(
  store: RecordStore,
  matching: readonly RequestRow[],
): Arrangement<RequestRow, RequestGroup> {
  const homeOf = (row: RequestRow) => firstAskOf(row)?.requesterId ?? null;
  const counts = countValues(matching.flatMap((row) => homeOf(row) ?? []));
  const nameOf = (userId: string) => store.users.find((user) => user.id === userId)?.name ?? userId;
  const order = counts
    .toSorted(
      (first, second) =>
        second.count - first.count || nameOf(first.value).localeCompare(nameOf(second.value)),
    )
    .map(({ value }) => value);

  return groupedBy(homeOf, order, (userId, total, rowCount) => ({
    kind: "requester",
    userId: userId ?? "",
    sharedCount: matching.filter((row) => homeOf(row) === userId && askerIdsOf(row).length > 1)
      .length,
    total,
    rowCount,
  }));
}

// ---------------------------------------------------------------- history

// The status log of the asks and of the attempts before them, newest first.
function logOf(store: RecordStore, row: RequestRow): StatusLogEntry[] {
  const subjects = new Set(
    [...row.record.requests, ...row.record.iterations].map((entry) => entry.id),
  );
  return oncePerCause(statusLogForSubjectsOf(store, subjects));
}
