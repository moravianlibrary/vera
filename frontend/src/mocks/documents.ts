// What the server does for the Documents resource: assemble one record per document, keep it
// to the caller's reach, withhold what their grants do not cover, then search, filter, count,
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
import type { AskDecision, Audience, DocumentRecord } from "@/domain/documents";
import {
  askDecisionSchema,
  askersOf,
  batchIdOf,
  currentIterationOf,
  effectivePageCount,
  existingCopyStateOf,
  followedIterationId,
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
import { hasPermission } from "@/domain/permissions";
import { isRestricted, validationOf } from "@/domain/status";
import { isWithinRange } from "@/lib/value-range";
import type { Arrangement as GenericArrangement } from "@/mocks/arrangement";
import { countValues, groupedBy, sliceOf } from "@/mocks/arrangement";
import { database } from "@/mocks/database";

export function queryDocuments(
  session: Session,
  query: DocumentQuery,
  slice: Required<DocumentSlice> = { cursor: null, limit: documentSliceSize },
  grouping: DocumentGrouping | null = null,
): DocumentPage {
  const audience = audienceOf(session);
  const userId = session.user.id;
  const reachable = database.documents
    .map(recordOf)
    .filter((record) => isInReach(record, audience, userId))
    .map((record) => redact(record, session, audience));

  const fields = audienceFields[audience];
  const valuesOf = fieldValuesOf(userId);
  const predicates = predicatesOf(query, audience, valuesOf, userId);
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
  };
}

export function findDocumentDetail(session: Session, documentId: string): DocumentDetail | null {
  const audience = audienceOf(session);
  const document = database.documents.find((candidate) => candidate.id === documentId);
  if (document === undefined) {
    return null;
  }

  const record = recordOf(document);
  if (!isInReach(record, audience, session.user.id)) {
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

// A requester reaches only what they asked for; a document nobody asked for is not a record.
function isInReach(record: DocumentRecord, audience: Audience, userId: string): boolean {
  if (audience === "staff") {
    return record.requests.length > 0;
  }

  return requestsBy(record, userId).length > 0;
}

function redact(record: DocumentRecord, session: Session, audience: Audience): DocumentRecord {
  if (audience === "public") {
    return publicRecordOf(record, session.user.id);
  }

  if (hasPermission(session, "addition.read")) {
    return record;
  }

  return { ...record, iterations: record.iterations.map(withoutIngestError) };
}

// Own asks only, the iterations they follow, and the public half of every reason.
function publicRecordOf(record: DocumentRecord, userId: string): DocumentRecord {
  const requests = requestsBy(record, userId).toReversed().map(publicRequestOf);
  const followed = new Set(requests.map(followedIterationId));
  return {
    document: record.document,
    iterations: record.iterations
      .filter((iteration) => followed.has(iteration.id))
      .map(publicIterationOf),
    requests,
  };
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

type FilterField = "search" | "isMine" | DocumentListField | DocumentRangeField;

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
        askersOf(record).some((request) => isWithinRange(request.at.slice(0, 10), asked)),
    });
  }

  return predicates;
}

// Text matches title and identifiers; an iteration or request ID matches whole, so IT1 is not
// IT12 (view-rules.md §3).
function matchesSearch(record: DocumentRecord, search: string): boolean {
  const needle = search.toLowerCase();
  const { document } = record;
  const texts = [document.title, document.catalogId, document.unit?.value, document.signature];
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

// Batches are the staff's unit of retry, so they need `addition.read`; a requester's list is
// never grouped.
function groupingFor(
  session: Session,
  audience: Audience,
  grouping: DocumentGrouping | null,
): DocumentGrouping | null {
  if (audience === "public") {
    return null;
  }

  if (grouping === "batch" && !hasPermission(session, "addition.read")) {
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

// Batches with failed additions first, as that is what an admin retries; then newest first, and
// the rows from no batch last.
function batchArrangementOf(reachable: readonly DocumentRecord[]): Arrangement {
  const isFailed = (record: DocumentRecord) =>
    currentIterationOf(record)?.progress === "IngestFailed";
  const inBatch = (batchId: string) => reachable.filter((record) => batchIdOf(record) === batchId);
  const batchOrder = database.batches
    .map((batch) => ({
      batch,
      size: inBatch(batch.id).length,
      failed: inBatch(batch.id).filter(isFailed).length,
    }))
    .toSorted(
      (first, second) =>
        second.failed - first.failed ||
        second.batch.submittedAt.localeCompare(first.batch.submittedAt),
    );
  const keys = batchOrder.map((entry) => entry.batch.id);

  return groupedBy(batchIdOf, keys, (batchId, total, rowCount) => {
    const entry = batchOrder.find((candidate) => candidate.batch.id === batchId);
    return {
      kind: "batch",
      batch: entry?.batch ?? null,
      size: entry?.size ?? total,
      failed: entry?.failed ?? 0,
      total,
      rowCount,
    };
  });
}

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
  return (first: DocumentRecord, second: DocumentRecord): number =>
    (requestsBy(second, userId)[0]?.at ?? "").localeCompare(requestsBy(first, userId)[0]?.at ?? "");
}

// ---------------------------------------------------------------- history

// Staff read the whole story, less an ingest error they may not read; a requester reads what
// happened in plain words, not who did it or why.
function logOf(record: DocumentRecord, session: Session, audience: Audience): StatusLogEntry[] {
  const subjects = new Set([...record.iterations, ...record.requests].map((entry) => entry.id));
  const entries = database.statusLog
    .filter((entry) => subjects.has(entry.subjectId))
    .toSorted((first, second) => second.at.localeCompare(first.at));
  if (audience === "staff") {
    // How an ingest failed is withheld with the failure's error (addition.read).
    return oncePerCause(
      hasPermission(session, "addition.read")
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
