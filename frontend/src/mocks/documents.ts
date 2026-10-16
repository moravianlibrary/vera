// What the server does for the Documents resource: assemble one record per document, keep it
// to the caller's reach (the scope of `iteration.read` for staff), withhold what their grants do not cover, then search, filter, count,
// sort and group. Kept apart from the handlers so it can be tested without HTTP.

import type {
  Answer,
  DocumentDetail,
  DocumentGroup,
  DocumentGrouping,
  DocumentListField,
  DocumentPage,
  DocumentQuery,
  DocumentRangeField,
  DocumentSlice,
} from "@/api/documents";
import { documentPageSchema, documentSliceSize } from "@/api/documents";
import { categoryLineageOf } from "@/domain/categories";
import type { AdditionState, AskDecision, Audience, DocumentRecord } from "@/domain/documents";
import {
  additionStateOf,
  additionStates,
  askDecisionSchema,
  askersOf,
  batchIdOf,
  currentIterationOf,
  effectivePageCount,
  existingCopyStateOf,
  followedIterationId,
  isShownAsBatch,
  latestPublicAskOf,
  projectIdOf,
  publicRecordStatusOf,
  requestsBy,
} from "@/domain/documents";
import type {
  Decision,
  Document,
  Iteration,
  Request,
  Session,
  StatusLogEntry,
} from "@/domain/entities";
import { scopeOfIteration } from "@/domain/iterations";
import { can, hasPermission, isWithinScope, scopesOf } from "@/domain/permissions";
import { scopeOfProject } from "@/domain/projects";
import type { PropertyValues } from "@/domain/properties";
import { isRestricted, validationOf } from "@/domain/status";
import { isWithinRange, resolveDayRange } from "@/lib/value-range";
import type { Arrangement as GenericArrangement } from "@/mocks/arrangement";
import { countValues, groupedBy, sliceOf } from "@/mocks/arrangement";
import { servedBatches, shownBatchIdOf } from "@/mocks/batches";
import { database } from "@/mocks/database";
import {
  filterablePropertiesOf,
  propertyFacetsOf,
  propertyPredicatesOf,
  publicPropertyKeys,
} from "@/mocks/properties";
import { mockToday } from "@/mocks/today";

export function queryDocuments(
  session: Session,
  query: DocumentQuery,
  slice: Required<DocumentSlice> = { cursor: null, limit: documentSliceSize },
  grouping: DocumentGrouping | null = null,
  requestedAudience?: Audience,
): DocumentPage {
  const audience = requestedAudience ?? audienceOf(session);
  const userId = session.user.id;
  const reachable = database.documents
    .map(recordOf)
    .filter((record) => isInReach(session, record, audience))
    .map((record) => redact(record, session, audience));

  const fields = audienceFields[audience];
  const valuesOf = fieldValuesOf(userId);
  // DOC-property-filter: a property is filtered on where it is read, against the current attempt.
  const properties = filterablePropertiesOf(session, audience === "public");
  const predicates = [
    ...predicatesOf(query, audience, valuesOf, userId),
    ...propertyPredicatesOf(query.properties, properties).map(
      ({ key, matches }): Predicate => ({
        field: `p.${key}`,
        matches: (record) =>
          matches({ document: record.document, iteration: currentIterationOf(record) }),
      }),
    ),
  ];
  // A facet counts over every other filter, so picking a value never hides its siblings.
  const matchingAllBut = (field: FilterField | null) =>
    reachable.filter((record) =>
      predicates.every((predicate) => predicate.field === field || predicate.matches(record)),
    );

  const matching = matchingAllBut(null).toSorted(
    audience === "staff" ? byPriorityThenActivity : byOwnLatestAsk(userId),
  );
  const arrangement = arrangementOf(groupingFor(session, audience, grouping), reachable);
  const arranged = arrangement === null ? matching : arrangement.sorted(matching);
  const { items, nextCursor } = sliceOf(arranged, (record) => record.document.id, slice);

  return {
    audience,
    items,
    total: matching.length,
    nextCursor,
    groups: arrangement === null ? [] : arrangement.headersOf(items, matching),
    facets: facetsOf(fields, valuesOf, matchingAllBut),
    propertyFacets: propertyFacetsOf(properties, (key) =>
      matchingAllBut(`p.${key}`).map((record) => ({
        document: record.document,
        iteration: currentIterationOf(record),
      })),
    ),
  };
}

export function findDocumentDetail(
  session: Session,
  documentId: string,
  requestedAudience?: Audience,
): DocumentDetail | null {
  const audience = requestedAudience ?? audienceOf(session);
  const document = database.documents.find((candidate) => candidate.id === documentId);
  if (document === undefined) {
    return null;
  }

  const record = recordOf(document);
  if (!isInReach(session, record, audience)) {
    return null;
  }

  const visible = redact(record, session, audience);
  return { audience, record: visible, log: logOf(visible, session, audience) };
}

// ---------------------------------------------------------------- reach and redaction

export function audienceOf(session: Session): Audience {
  return hasPermission(session, "iteration.read") ? "staff" : "public";
}

export function recordOf(document: Document): DocumentRecord {
  return {
    document,
    iterations: database.iterations
      .filter((iteration) => iteration.documentId === document.id)
      .toSorted((first, second) => first.attempt - second.attempt),
    requests: database.requests
      .filter((request) => request.documentId === document.id)
      .toSorted((first, second) => first.at.localeCompare(second.at)),
  };
}

// A document nobody asked for is not a record (VIEW-documents-audience).
function isInReach(session: Session, record: DocumentRecord, audience: Audience): boolean {
  if (audience === "staff") {
    return isInStaffReach(session, record);
  }

  return publicAsksOf(session, record).length > 0;
}

// The asks a person reads in public detail, on My Documents: their own, and at
// `request.read_mine@project` those made into the projects they are on.
function publicAsksOf(session: Session, record: DocumentRecord): Request[] {
  const projectScoped = scopesOf(session, "request.read_mine").includes("project");
  const isOnProject = (projectId: string | null) => {
    const project = database.projects.find((candidate) => candidate.id === projectId);
    return project !== undefined && isWithinScope(session, "project", scopeOfProject(project));
  };
  return record.requests.filter(
    (request) =>
      request.requesterId === session.user.id || (projectScoped && isOnProject(request.projectId)),
  );
}

// Documents holds approved work only, until it is published: a document with an iteration
// (VIEW-documents-audience). Its reach follows the scope of `iteration.read`, and every scope
// also reaches one's own asks: at `any` every document; at `custody` one whose current iteration
// is in the holder's category custody (SCOPE-custody-category); at `project` one asked for or
// funded through a project they are on (SCOPE-project).
function isInStaffReach(session: Session, record: DocumentRecord): boolean {
  const current = currentIterationOf(record);
  if (current === null || !can(session, "iteration.read")) {
    return false;
  }
  if (
    can(session, "iteration.read", { kind: "unscoped" }) ||
    requestsBy(record, session.user.id).length > 0 ||
    can(session, "iteration.read", scopeOfIteration(database.categories, current.categoryId))
  ) {
    return true;
  }

  const projectIds = new Set(
    [...record.requests, ...record.iterations].map((source) => source.projectId),
  );
  return database.projects.some(
    (project) =>
      projectIds.has(project.id) && can(session, "iteration.read", scopeOfProject(project)),
  );
}

function redact(record: DocumentRecord, session: Session, audience: Audience): DocumentRecord {
  if (audience === "public") {
    return publicRecordOf(record, publicAsksOf(session, record));
  }

  if (hasPermission(session, "request.read_ingest")) {
    return record;
  }

  return { ...record, iterations: record.iterations.map(withoutIngestError) };
}

// The asks the reader reaches, the iterations they follow, and the public half of every reason.
function publicRecordOf(record: DocumentRecord, asks: readonly Request[]): DocumentRecord {
  const requests = asks.map(publicRequestOf);
  const followed = new Set(requests.map(followedIterationId));
  return {
    document: { ...record.document, properties: publicPropertiesOf(record.document.properties) },
    iterations: record.iterations
      .filter((iteration) => followed.has(iteration.id))
      .map(publicIterationOf),
    requests,
  };
}

// DOC-property-visibility: a public reader reads the public properties, not who set them.
export function publicPropertiesOf(properties: readonly PropertyValues[]): PropertyValues[] {
  const publicKeys = publicPropertyKeys();
  return properties
    .filter((values) => publicKeys.has(values.key))
    .map((values) => ({
      ...values,
      sources: values.sources.map((source) => ({ ...source, setBy: null })),
    }));
}

function publicRequestOf(request: Request): Request {
  if (request.decision !== "Denied") {
    return request;
  }

  return { ...request, decline: { ...request.decline, internalText: null } };
}

function publicIterationOf(iteration: Iteration): Iteration {
  return {
    ...withoutIngestError(iteration),
    properties: publicPropertiesOf(iteration.properties),
    restriction: iteration.restriction && { ...iteration.restriction, internalText: null },
    cancellation: iteration.cancellation && { ...iteration.cancellation, internalText: null },
    defects: iteration.defects.map((defect) => ({ ...defect, internalText: null })),
  };
}

function withoutIngestError(iteration: Iteration): Iteration {
  if (iteration.ingestFailure === null) {
    return iteration;
  }

  return { ...iteration, ingestFailure: { ...iteration.ingestFailure, error: null } };
}

// ---------------------------------------------------------------- filters

// A property's condition counts as its own field, `p.<key>`.
type FilterField = "search" | "isMine" | DocumentListField | DocumentRangeField | `p.${string}`;

interface Predicate {
  field: FilterField;
  matches: (record: DocumentRecord) => boolean;
}

// The list fields each audience has. A requester's view has only the status; the others are
// staff machinery and do not exist for them, so the server ignores them.
const audienceFields = {
  staff: [
    "decisions",
    "progress",
    "validations",
    "forbidden",
    "cancelled",
    "categoryIds",
    "projectIds",
    "priorities",
    "existingCopies",
    "askerIds",
  ],
  public: ["statuses"],
} as const satisfies Record<Audience, readonly DocumentListField[]>;

type FieldValues = Record<DocumentListField, (record: DocumentRecord) => readonly string[]>;

function predicatesOf(
  query: DocumentQuery,
  audience: Audience,
  valuesOf: FieldValues,
  userId: string,
): Predicate[] {
  const predicates: Predicate[] = [];
  const { search } = query;
  if (search !== undefined) {
    predicates.push({ field: "search", matches: (record) => matchesSearch(record, search) });
  }

  if (query.isMine === true && audience === "staff") {
    predicates.push({
      field: "isMine",
      matches: (record) => requestsBy(record, userId).length > 0,
    });
  }

  for (const field of audienceFields[audience]) {
    const wanted = query[field];
    if (wanted === undefined || wanted.length === 0) {
      continue;
    }

    const wantedValues = new Set<string>(wanted);
    predicates.push({
      field,
      matches: (record) => valuesOf[field](record).some((value) => wantedValues.has(value)),
    });
  }

  if (audience === "staff") {
    predicates.push(...rangePredicatesOf(query));
  }

  return predicates;
}

// A document with no page count is in no page range; one asked on several days is in a range
// when any current asker asked within it.
function rangePredicatesOf({ pages, asked }: DocumentQuery): Predicate[] {
  const predicates: Predicate[] = [];
  if (pages !== undefined) {
    predicates.push({
      field: "pages",
      matches: (record) => {
        const count = effectivePageCount(record.document);
        return count !== null && isWithinRange(count.value, pages);
      },
    });
  }

  if (asked !== undefined) {
    predicates.push({
      field: "asked",
      matches: (record) =>
        askersOf(record).some((request) =>
          isWithinRange(request.at.slice(0, 10), resolveDayRange(asked, mockToday)),
        ),
    });
  }

  return predicates;
}

// Text matches title and identifiers; an iteration or request ID matches whole, so IT1 is not
// IT12 (view-rules.md §3).
function matchesSearch(record: DocumentRecord, search: string): boolean {
  const needle = search.toLowerCase();
  const { document } = record;
  const texts = [document.title, document.catalogId, document.unit?.value, document.shelfMark];
  const ids = [...record.iterations, ...record.requests].map((entry) => entry.id.toLowerCase());
  return texts.some((text) => text?.toLowerCase().includes(needle)) || ids.includes(needle);
}

// ---------------------------------------------------------------- facets

// The values a record holds for each field; a record can hold several, or none.
function fieldValuesOf(userId: string): FieldValues {
  const ofCurrent =
    <Value extends string>(stateOf: (iteration: Iteration) => Value) =>
    (record: DocumentRecord): Value[] => {
      const current = currentIterationOf(record);
      return current === null ? [] : [stateOf(current)];
    };

  return {
    statuses: (record) => {
      const status = publicRecordStatusOf(record, userId);
      return status === null ? [] : [status];
    },
    decisions: (record) => [
      ...new Set(
        askersOf(record).flatMap(({ decision }) => (isAskDecision(decision) ? [decision] : [])),
      ),
    ],
    progress: ofCurrent((iteration) => iteration.progress),
    validations: ofCurrent(validationOf),
    forbidden: ofCurrent((iteration) => answerOf(isRestricted(iteration))),
    cancelled: ofCurrent((iteration) => answerOf(iteration.cancellation !== null)),
    // A category holds every category above it too, so it matches its whole subtree.
    categoryIds: ofCurrentList((iteration) =>
      categoryLineageOf(database.categories, iteration.categoryId),
    ),
    projectIds: (record) => {
      const projectId = projectIdOf(record);
      return projectId === null ? [] : [projectId];
    },
    priorities: ofCurrent((iteration) => iteration.priority),
    existingCopies: (record) => [existingCopyStateOf(record.document)],
    askerIds: (record) => [...new Set(askersOf(record).map((request) => request.requesterId))],
  };
}

function ofCurrentList(valuesOf: (iteration: Iteration) => readonly string[]) {
  return (record: DocumentRecord): readonly string[] => {
    const current = currentIterationOf(record);
    return current === null ? [] : valuesOf(current);
  };
}

function isAskDecision(decision: Decision): decision is AskDecision {
  return askDecisionSchema.safeParse(decision).success;
}

function answerOf(isTrue: boolean): Answer {
  return isTrue ? "Yes" : "No";
}

function facetsOf(
  fields: readonly DocumentListField[],
  valuesOf: FieldValues,
  matchingAllBut: (field: FilterField) => DocumentRecord[],
): DocumentPage["facets"] {
  const countOf = (field: DocumentListField) =>
    fields.includes(field) ? countValues(matchingAllBut(field).flatMap(valuesOf[field])) : [];

  // Each list's values were produced by that field's own value function.
  return documentPageSchema.shape.facets.parse({
    statuses: countOf("statuses"),
    decisions: countOf("decisions"),
    progress: countOf("progress"),
    validations: countOf("validations"),
    forbidden: countOf("forbidden"),
    cancelled: countOf("cancelled"),
    categoryIds: countOf("categoryIds"),
    projectIds: countOf("projectIds"),
    priorities: countOf("priorities"),
    existingCopies: countOf("existingCopies"),
    askerIds: countOf("askerIds"),
  });
}

// ---------------------------------------------------------------- grouping

type Arrangement = GenericArrangement<DocumentRecord, DocumentGroup>;

// Batches are the staff's unit of retry, so they need `request.read_ingest`; a requester's list is
// never grouped.
function groupingFor(
  session: Session,
  audience: Audience,
  grouping: DocumentGrouping | null,
): DocumentGrouping | null {
  if (audience === "public") {
    return null;
  }

  if (grouping === "batch" && !hasPermission(session, "request.read_ingest")) {
    return null;
  }

  return grouping;
}

function arrangementOf(
  grouping: DocumentGrouping | null,
  reachable: readonly DocumentRecord[],
): Arrangement | null {
  if (grouping === "batch") {
    return batchArrangementOf(reachable);
  }

  if (grouping === "project") {
    return projectArrangementOf();
  }

  return null;
}

// Batches with failed additions first, as that is what is retried; then newest first, and
// the rows asked for one at a time, a batch of one, last (ENT-batch).
function batchArrangementOf(reachable: readonly DocumentRecord[]): Arrangement {
  const additionsOf = (batchId: string) => {
    const records = reachable.filter((record) => batchIdOf(record) === batchId);
    const states = records.map(additionStateOf);
    const additions = Object.fromEntries(
      additionStates.map((state) => [state, states.filter((each) => each === state).length]),
    ) as Record<AdditionState, number>;
    return { size: records.length, additions };
  };
  const batchOrder = servedBatches()
    .filter(isShownAsBatch)
    .map((batch) => ({ batch, ...additionsOf(batch.id) }))
    .toSorted(
      (first, second) =>
        second.additions.failed - first.additions.failed ||
        second.batch.submittedAt.localeCompare(first.batch.submittedAt),
    );
  const keys = batchOrder.map((entry) => entry.batch.id);

  const shownOf = (record: DocumentRecord) => shownBatchIdOf(batchIdOf(record));
  return groupedBy(shownOf, keys, (batchId, total, rowCount) => {
    const entry = batchOrder.find((candidate) => candidate.batch.id === batchId);
    return {
      kind: "batch",
      batch: entry?.batch ?? null,
      size: entry?.size ?? total,
      additions: entry?.additions ?? noAdditions,
      total,
      rowCount,
    };
  });
}

const noAdditions = Object.fromEntries(additionStates.map((state) => [state, 0])) as Record<
  AdditionState,
  number
>;

// Projects by name, the rows funded by none last.
function projectArrangementOf(): Arrangement {
  const ordered = database.projects.toSorted((first, second) =>
    first.name.localeCompare(second.name),
  );

  return groupedBy(
    projectIdOf,
    ordered.map((project) => project.id),
    (projectId, total, rowCount) => ({
      kind: "project",
      project: ordered.find((project) => project.id === projectId) ?? null,
      total,
      rowCount,
    }),
  );
}

// ---------------------------------------------------------------- order

const priorityRank = { Low: 0, Normal: 1, High: 2, Urgent: 3 } as const;
// A document still in review has no priority yet; it sorts between Normal and High.
const undecidedPriorityRank = 1.5;

function byPriorityThenActivity(first: DocumentRecord, second: DocumentRecord): number {
  return (
    priorityOf(second) - priorityOf(first) ||
    latestActivityOf(second).localeCompare(latestActivityOf(first))
  );
}

function priorityOf(record: DocumentRecord): number {
  const current = currentIterationOf(record);
  return current === null ? undecidedPriorityRank : priorityRank[current.priority];
}

function latestActivityOf(record: DocumentRecord): string {
  return (
    record.requests
      .map((request) => request.at)
      .toSorted()
      .at(-1) ?? ""
  );
}

function byOwnLatestAsk(userId: string) {
  const latestAt = (record: DocumentRecord) => latestPublicAskOf(record, userId)?.at ?? "";
  return (first: DocumentRecord, second: DocumentRecord): number =>
    latestAt(second).localeCompare(latestAt(first));
}

// ---------------------------------------------------------------- history

// Staff read the whole story, less an ingest error they may not read; a requester reads what
// happened in plain words, not who did it or why.
function logOf(record: DocumentRecord, session: Session, audience: Audience): StatusLogEntry[] {
  const subjects = new Set(
    [record.document, ...record.iterations, ...record.requests].map((entry) => entry.id),
  );
  const entries = database.statusLog
    .filter((entry) => subjects.has(entry.subjectId))
    .toSorted((first, second) => second.at.localeCompare(first.at));
  if (audience === "staff") {
    // How an ingest failed is withheld with the failure's error (request.read_ingest).
    return oncePerCause(
      hasPermission(session, "request.read_ingest")
        ? entries
        : entries.map((entry) => (isIngestEvent(entry) ? { ...entry, detail: null } : entry)),
    );
  }

  return entries.flatMap((entry) => {
    const event = publicEventOf(entry.event);
    if (event === null) {
      return [];
    }

    return [
      {
        ...entry,
        event,
        actor: entry.actor.kind === "system" ? entry.actor : { kind: "undisclosed" },
        detail: null,
      },
    ];
  });
}

// One decision on several asks is written once per ask, so each asker's history holds it; staff
// read it once.
export function oncePerCause(entries: readonly StatusLogEntry[]): StatusLogEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const cause = `${entry.correlationId}|${entry.event}`;
    if (seen.has(cause)) {
      return false;
    }

    seen.add(cause);
    return true;
  });
}

function isIngestEvent(entry: StatusLogEntry): boolean {
  return entry.event.startsWith("Ingest");
}

// A requester reads their request's story in plain language (status-log.md §7): what moved it
// forward or held it, never the checks, retries and corrections behind it.
// TODO(rrandiak): carry the public wording on the event codes once the log contract exists.
const publicEvents = [
  { prefix: "Approved", wording: "Accepted" },
  { prefix: "Declined", wording: "Not accepted" },
  { prefix: "Forbidden", wording: "Not available for digitization" },
  { prefix: "Cancelled", wording: "On hold" },
  { prefix: "Digitized", wording: "Digitized" },
  { prefix: "Published", wording: "Available to read" },
] as const;

function publicEventOf(event: string): string | null {
  return publicEvents.find((entry) => event.startsWith(entry.prefix))?.wording ?? null;
}
