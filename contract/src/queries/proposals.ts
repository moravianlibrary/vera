// What the server does when someone proposes: check each item against the catalog, then against
// the documents VERA holds, and on submit turn what checked out into requests, one batch when
// there are several (view-map.md §1, propose; status-model.md §2.7–2.8). An item is resolved
// again on submit; what the dialog was told is never trusted.

import type { RecordStatus } from "@vera/contract/documents";
import type {
  ProposalCheck,
  ProposalDraft,
  ProposalItem,
  ProposalReport,
  ProposalSettings,
  RateLimitStatus,
} from "@vera/contract/proposals";
import type { StoredBatch } from "@vera/domain/batches";
import { servedBatchOf } from "@vera/domain/batches";
import type { CatalogRecord } from "@vera/domain/catalog";
import type { DocumentRecord } from "@vera/domain/documents";
import {
  currentIterationOf,
  followedIterationId,
  isAttemptOver,
  recordStatusOf,
} from "@vera/domain/documents";
import type {
  Document,
  ExistingCopy,
  Iteration,
  Project,
  RegistryRecord,
  Request,
  Session,
} from "@vera/domain/entities";
import type { EventEntryInput } from "@vera/domain/events";
import { primaryLinkOf } from "@vera/domain/iterations";
import { isProjectMember } from "@vera/domain/projects";
import { defaultBatchNameOf } from "@vera/domain/proposals";
import { isProgressAtLeast, publicIterationStatusOf } from "@vera/domain/status";
import type { RecordStore } from "@vera/domain/store";
import {
  documentByIdentityOf,
  iterationsByDocumentOf,
  requestsByDocumentOf,
} from "@vera/domain/store-index";
import { audienceOf } from "./documents";

// What the proposing code asks the plugins (ACT-ways-in, DOC-property-predefined): the catalog
// adapter's records beyond what VERA holds, its reading of a new document's catalog facts, and
// the ways in the enabled instances offer.
export interface ProposalPlugins {
  catalogRecords(): readonly CatalogRecord[];
  registryLookup(record: CatalogRecord, unit: string | null): readonly RegistryAnswer[];
  catalogPropertyValuesOf(
    read: Pick<Document, "title" | "type" | "shelfMark">,
    observedAt: string,
  ): import("@vera/domain/properties").PropertyValues[];
  waysIn(): Omit<ProposalSettings, "maxAtOnce">;
}

export interface RegistryAnswer {
  registry: string;
  state: RegistryRecord["state"];
  link: string | null;
}

// The library's calendar day is Prague time (ROLE-library-day). Both proposal limits belong to roles.

function roleProposalLimitOf(
  store: RecordStore,
  session: Session,
  field: "proposalBatchLimit" | "proposalDailyLimit",
): number | null {
  const limits = store.roles
    .filter(
      (role) =>
        session.roleIds.includes(role.id) &&
        role.grants.some((grant) => grant.permission === "request.create"),
    )
    .map((role) => role[field]);
  if (limits.includes(null)) return null;
  return Math.max(0, ...limits.filter((limit): limit is number => limit !== null));
}
export function proposalLimitOf(store: RecordStore, session: Session): number | null {
  return roleProposalLimitOf(store, session, "proposalBatchLimit");
}
function dailyLimitOf(store: RecordStore, session: Session): number | null {
  return roleProposalLimitOf(store, session, "proposalDailyLimit");
}
export function proposalSettingsOf(
  store: RecordStore,
  plugins: ProposalPlugins,
  session: Session,
): ProposalSettings {
  return { maxAtOnce: proposalLimitOf(store, session), ...plugins.waysIn() };
}
const libraryDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function libraryDayOf(moment: Date): string {
  return libraryDayFormatter.format(moment);
}
// The caller's requests stored on the library's day of now, joined ones included (L10).
function submissionCountToday(store: RecordStore, session: Session, now: Date): number {
  const today = libraryDayOf(now);
  return store.requests.filter(
    (request) =>
      request.requesterId === session.user.id && libraryDayOf(new Date(request.at)) === today,
  ).length;
}
export function getRateLimitStatus(
  store: RecordStore,
  session: Session,
  now: Date,
): RateLimitStatus {
  const limit = dailyLimitOf(store, session);
  return {
    perDay: limit === null ? null : Math.max(0, limit - submissionCountToday(store, session, now)),
  };
}
export function canSubmitRateLimited(
  store: RecordStore,
  session: Session,
  count: number,
  now: Date,
): boolean {
  const limit = dailyLimitOf(store, session);
  return limit === null || submissionCountToday(store, session, now) + count <= limit;
}
// The projects the caller may propose into: a member's, and not Rejected (projects.md §4).
export function proposableProjectsOf(store: RecordStore, session: Session): Project[] {
  return store.projects.filter(
    (project) =>
      project.state !== "Rejected" && isProjectMember(project, session.user.id, session.groupIds),
  );
}

// ---------------------------------------------------------------- check

interface Resolved {
  record: CatalogRecord;
  unit: string | null;
}
type Resolution =
  | Resolved
  | { units: readonly string[]; record: CatalogRecord }
  | { records: readonly CatalogRecord[] }
  | null;
// LC-REQ-preview: look up the item and preview its copy and restriction checks when requested.
export function checkItem(
  store: RecordStore,
  plugins: ProposalPlugins,
  session: Session,
  item: ProposalItem,
  includePreview = true,
  now = store.today,
): ProposalCheck {
  const resolution = resolve(store, plugins, item);
  if (resolution === null) return { kind: "notInCatalog" };
  if ("records" in resolution)
    return {
      kind: "whichRecord",
      records: resolution.records.map(({ catalogId, title }) => ({ catalogId, title })),
    };
  const { record } = resolution;
  if ("units" in resolution)
    return {
      kind: "whichUnit",
      catalogId: record.catalogId,
      title: record.title,
      units: [...resolution.units],
    };
  const found = {
    catalogId: record.catalogId,
    unit: resolution.unit,
    title: resolution.unit === null ? record.title : `${record.title} · ${resolution.unit}`,
  };
  const document = findDocumentByIdentity(store, record.catalogId, resolution.unit);
  if (document === null)
    return {
      kind: "new",
      ...found,
      isAskedBefore: false,
      preview: includePreview
        ? previewForNew(
            plugins,
            record,
            resolution.unit,
            audienceOf(store, session) === "staff",
            now,
          )
        : { copies: [] },
    };
  const held = recordOf(store, document);
  if (isAskedBy(held, session.user.id)) return { kind: "mine", ...found, documentId: document.id };
  if (!isLive(held))
    return {
      kind: "new",
      ...found,
      isAskedBefore: held.requests.length > 0,
      preview: includePreview
        ? previewFor(held, record, plugins, audienceOf(store, session) === "staff", now)
        : { copies: [] },
    };
  return {
    kind: "inVera",
    ...found,
    documentId: document.id,
    status: statusFor(store, session, held),
    preview: includePreview
      ? previewFor(held, record, plugins, audienceOf(store, session) === "staff", now)
      : { copies: [] },
  };
}
// LC-REQ-preview: report the known copies and staff-only restriction finding for one held item.
function previewFor(
  record: DocumentRecord,
  catalogRecord: CatalogRecord,
  plugins: ProposalPlugins,
  staff: boolean,
  now: Date,
) {
  const document = withRegistryAnswers(
    record.document,
    plugins.registryLookup(catalogRecord, record.document.unit?.value ?? null),
    now,
  );
  const copies = existingCopiesFor({ ...record, document }, now.toISOString()).map(
    ({ source, state, link }) => ({ source, state, link }),
  );
  const restriction = currentIterationOf(record)?.restriction;
  return {
    copies,
    ...(staff
      ? {
          restrictions:
            restriction === null || restriction === undefined
              ? []
              : [
                  {
                    forbidden: true,
                    until: null,
                    why: restriction.internalText ?? restriction.publicText ?? restriction.rule,
                  },
                ],
        }
      : {}),
  };
}
// LC-REQ-preview: show the registry's answer for a catalog item VERA does not hold.
function previewForNew(
  plugins: ProposalPlugins,
  catalogRecord: CatalogRecord,
  unit: string | null,
  staff: boolean,
  now: Date,
) {
  const document = withRegistryAnswers(
    {
      id: "preview",
      catalogId: catalogRecord.catalogId,
      unit: unit === null ? null : { type: unitTypeOf(unit), value: unit },
      title: catalogRecord.title,
      type: catalogRecord.type,
      shelfMark: null,
      pageSources: [],
      registryRecords: [],
      properties: [],
    },
    plugins.registryLookup(catalogRecord, unit),
    now,
  );
  const copies = existingCopiesFor(
    { document, iterations: [], requests: [] },
    now.toISOString(),
  ).map(({ source, state, link }) => ({ source, state, link }));
  return { copies, ...(staff ? { restrictions: [] } : {}) };
}
export function submittableProposalItemCount(
  store: RecordStore,
  plugins: ProposalPlugins,
  session: Session,
  draft: ProposalDraft,
): number {
  // The quota counts requests actually made, including joining an existing document.
  // Items that the submit report will skip do not consume it.
  return draft.items.filter((item) =>
    ["new", "inVera"].includes(checkItem(store, plugins, session, item, false).kind),
  ).length;
}
// The catalog's answer: a record, and the unit when the record has several.
function resolve(store: RecordStore, plugins: ProposalPlugins, item: ProposalItem): Resolution {
  const records = catalogRecordsOf(store, plugins, item);
  const [record] = records;
  if (record === undefined) return null;
  // DOC-records: the catalog's answer is several records; the person picks.
  if (records.length > 1) return { records };
  const barcodeUnit = item.type === "barcode" ? record.barcodes[item.value] : undefined;
  if (barcodeUnit !== undefined) return { record, unit: barcodeUnit };
  // DOC-units: a shelf mark names its unit when the catalog puts it on one; otherwise the unit is
  // chosen as for any identifier of the record.
  const shelfMarkUnit = item.type === "shelfMark" ? shelfMarkUnitOf(record, item.value) : null;
  if (shelfMarkUnit !== null) return { record, unit: shelfMarkUnit };
  if (record.units === null) return { record, unit: null };
  if (item.unit !== null && record.units.includes(item.unit)) return { record, unit: item.unit };
  // One unit is no choice to make.
  const [onlyUnit] = record.units;
  if (record.units.length === 1 && onlyUnit !== undefined && item.unit === null)
    return { record, unit: onlyUnit };
  return { record, units: record.units };
}
// Every record the identifier names, once each: a record VERA holds is known twice, from the
// fixtures and from its documents.
function catalogRecordsOf(
  store: RecordStore,
  plugins: ProposalPlugins,
  item: ProposalItem,
): CatalogRecord[] {
  const normalized = (value: string) => value.replaceAll("-", "").toLowerCase();
  const matching = knownCatalogRecords(store, plugins).filter((candidate) => {
    switch (item.type) {
      case "catalogId":
        return candidate.catalogId === item.value.toUpperCase();
      case "barcode":
        return item.value in candidate.barcodes;
      // DOC-identifiers: a shelf mark has no common format, so it is matched as it is written.
      case "shelfMark":
        return shelfMarkOf(candidate, item.value) !== undefined;
      default:
        return candidate.identifiers.some(
          (identifier) => normalized(identifier) === normalized(item.value),
        );
    }
  });
  return matching.filter(
    (record, index) =>
      matching.findIndex((other) => other.catalogId === record.catalogId) === index,
  );
}
// The record's shelf mark written as the value is, ignoring case; undefined when it has none.
function shelfMarkOf(record: CatalogRecord, value: string): string | undefined {
  const wanted = value.trim().toUpperCase();
  return Object.keys(record.shelfMarks).find((shelfMark) => shelfMark.toUpperCase() === wanted);
}
function shelfMarkUnitOf(record: CatalogRecord, value: string): string | null {
  const shelfMark = shelfMarkOf(record, value);
  return shelfMark === undefined ? null : (record.shelfMarks[shelfMark] ?? null);
}
function knownCatalogRecords(store: RecordStore, plugins: ProposalPlugins): CatalogRecord[] {
  return [...plugins.catalogRecords(), ...heldCatalogRecords(store)];
}
// The document VERA holds for a catalog ID and unit, which together are unique
// (document-identity.md).
function findDocumentByIdentity(
  store: RecordStore,
  catalogId: string,
  unit: string | null,
): Document | null {
  return documentByIdentityOf(store, catalogId, unit);
}
// What kind of unit a value is, by its shape: a barcode and a volume number are recognisable, a
// volume name is anything else (document-identity.md, Unit ID forms).
function unitTypeOf(unit: string): NonNullable<Document["unit"]>["type"] {
  if (/^MZK-\d{4}-\d{6}$/.test(unit)) return "barcode";
  return /^(roč\.|sv\.|vol\.)\s*\d+/.test(unit) ? "volume-number" : "volume-name";
}
const heldCatalogRecordsCache = new WeakMap<readonly Document[], CatalogRecord[]>();
function heldCatalogRecords(store: RecordStore): CatalogRecord[] {
  const cached = heldCatalogRecordsCache.get(store.documents);
  if (cached !== undefined) return cached;
  const byCatalogId = new Map<string, Document[]>();
  for (const document of store.documents)
    byCatalogId.set(document.catalogId, [...(byCatalogId.get(document.catalogId) ?? []), document]);
  const records = [...byCatalogId].map(([catalogId, documents]) => {
    const units = documents.flatMap((document) =>
      document.unit === null ? [] : [document.unit.value],
    );
    const barcodes = documents.flatMap((document) =>
      document.unit?.type === "barcode" ? [[document.unit.value, document.unit.value]] : [],
    );
    // A shelf mark on one unit names it; one shared by several units names none (DOC-units).
    const shelfMarks = new Map<string, string | null>();
    for (const document of documents)
      if (document.shelfMark !== null) {
        const unit = document.unit?.value ?? null;
        shelfMarks.set(document.shelfMark, shelfMarks.has(document.shelfMark) ? null : unit);
      }
    const [first] = documents;
    return {
      catalogId,
      title: first?.title ?? catalogId,
      type: first?.type ?? "Monograph",
      units: units.length === 0 ? null : units,
      identifiers: [],
      shelfMarks: Object.fromEntries(shelfMarks),
      barcodes: Object.fromEntries(barcodes),
    };
  });
  heldCatalogRecordsCache.set(store.documents, records);
  return records;
}
function recordOf(store: RecordStore, document: Document): DocumentRecord {
  return {
    document,
    iterations: [...(iterationsByDocumentOf(store).get(document.id) ?? [])].toSorted(
      (a, b) => a.attempt - b.attempt,
    ),
    requests: [...(requestsByDocumentOf(store).get(document.id) ?? [])],
  };
}
function isLive(record: DocumentRecord): boolean {
  // Work is moving: an attempt not yet over, or a decision every asker waits on. An ask after a
  // published or cancelled attempt is a new proposal, decided as a rescan (LC-REQ-join).
  return (
    isAttemptMoving(record) || record.requests.some((request) => request.decision === "Pending")
  );
}
function isAttemptMoving(record: DocumentRecord): boolean {
  const current = currentIterationOf(record);
  return current !== null && !isAttemptOver(current);
}
function isAskedBy(record: DocumentRecord, userId: string): boolean {
  const current = currentIterationOf(record);
  return record.requests.some(
    (request) => request.requesterId === userId && isStillAsked(request, current),
  );
}
function isStillAsked(request: Request, current: Iteration | null): boolean {
  // Open, or approved for an attempt not yet over: asking again is skipped (LC-REQ-check, mine).
  if (request.decision === "Pending") return true;
  if (request.decision !== "Approved" && request.decision !== "Duplicate") return false;
  // Approved, and not yet ingested.
  const followedId = followedIterationId(request);
  return followedId === null || (followedId === current?.id && !isAttemptOver(current));
}
function statusFor(store: RecordStore, session: Session, record: DocumentRecord): RecordStatus {
  const current = currentIterationOf(record);
  if (audienceOf(store, session) === "staff") return recordStatusOf(record) ?? "AwaitingReview";
  return current === null ? "WaitingForReview" : publicIterationStatusOf(current);
}

export interface SubmissionWrites {
  batch: StoredBatch | null;
  documents: Document[];
  iterations: Iteration[];
  requests: Request[];
  events: EventEntryInput[];
}
// ---------------------------------------------------------------- submit

// LC-REQ-checks-job: submit creates unchecked asks; the worker runs their copy checks later.
export function planSubmission(
  store: RecordStore,
  plugins: ProposalPlugins,
  session: Session,
  draft: ProposalDraft,
  now: Date,
  newId: (prefix: "R" | "IT" | "D") => string,
): { writes: SubmissionWrites; report: ProposalReport } {
  const nowIso = now.toISOString();
  let working: RecordStore = {
    ...store,
    batches: [...store.batches],
    documents: [...store.documents],
    iterations: [...store.iterations],
    requests: [...store.requests],
  };
  const project = working.projects.find((candidate) => candidate.id === draft.projectId);
  const submitted = draft.items.map((item) => ({
    item,
    check: checkItem(working, plugins, session, item, false, now),
  }));
  const accepted = submitted.filter(({ check }) => check.kind === "new" || check.kind === "inVera");
  let batch: StoredBatch | null = null;
  // Every submission is a batch, one item included (ENT-batch).
  if (accepted.length > 0) {
    const highest = Math.max(
      0,
      ...working.batches.map((candidate) => Number(candidate.id.replace(/^B-/, "")) || 0),
    );
    const source = plugins.waysIn().entrySources.find((entry) => entry.id === draft.entrySourceId);
    batch = {
      id: `B-${String(highest + 1).padStart(4, "0")}`,
      name: draft.batchName ?? defaultBatchNameOf(now),
      submittedBy: session.user.id,
      submittedAt: nowIso,
      source: source === undefined ? null : { instanceId: source.id, name: source.name },
    };
    working = { ...working, batches: [...working.batches, batch] };
  }
  const writes: SubmissionWrites = {
    batch,
    documents: [],
    iterations: [],
    requests: [],
    events: [],
  };
  let proposed = 0,
    approved = 0,
    joined = 0;
  // A batch's correlation ID groups the asks made by one submission.
  const correlationId = crypto.randomUUID();
  for (const { item, check } of accepted) {
    if (batch === null || (check.kind !== "new" && check.kind !== "inVera")) continue;
    let document = findDocumentByIdentity(working, check.catalogId, check.unit);
    if (document === null && check.kind === "new") {
      const record = knownCatalogRecords(working, plugins).find(
        (candidate) => candidate.catalogId === check.catalogId,
      );
      const read = {
        title: record?.title ?? check.catalogId,
        type: record?.type ?? ("Monograph" as const),
        shelfMark: null,
      };
      document = {
        id: newId("D"),
        catalogId: check.catalogId,
        unit: check.unit === null ? null : { type: unitTypeOf(check.unit), value: check.unit },
        ...read,
        pageSources: [],
        registryRecords: [],
        properties: plugins.catalogPropertyValuesOf(read, nowIso),
      };
      writes.documents.push(document);
      working = { ...working, documents: [...working.documents, document] };
    }
    if (document === null) continue;
    const record = recordOf(working, document);
    const base = {
      id: newId("R"),
      documentId: document.id,
      requesterId: session.user.id,
      at: nowIso,
      reason: item.reason ?? draft.reason,
      batchId: batch.id,
      projectId: project?.id ?? null,
      existingCopies: [],
      checkedAt: null,
      ...(check.kind === "new" && draft.approval !== null
        ? { approvalAfterCheck: draft.approval }
        : {}),
    };
    if (check.kind === "inVera") {
      const request = joiningRequestOf(record, base);
      appendRequest(writes, request);
      working = { ...working, requests: [...working.requests, request] };
      writes.events.push(createdEvent(request, batch, correlationId));
      joined++;
      continue;
    }
    proposed++;
    if (draft.approval !== null) {
      const request: Request = {
        ...base,
        decision: "Pending",
        isAfterProjectApproval: project?.state === "Approved",
      };
      appendRequest(writes, request);
      working = { ...working, requests: [...working.requests, request] };
      writes.events.push(createdEvent(request, batch, correlationId));
      writes.events.push({
        subjectKind: "request",
        subjectId: request.id,
        at: nowIso,
        actor: { kind: "user", userId: session.user.id },
        correlationId,
        code: "request.held",
        data: { why: "checking" },
        reason: { public: null, internal: null },
      });
      continue;
    }
    const request: Request = {
      ...base,
      // With a copy found, approve now leaves it Pending like any other (LC-REQ-approve-now).
      decision: "Pending",
      isAfterProjectApproval: project?.state === "Approved",
    };
    appendRequest(writes, request);
    working = { ...working, requests: [...working.requests, request] };
    writes.events.push(createdEvent(request, batch, correlationId));
  }
  return {
    writes,
    report: {
      batch: batch === null ? null : servedBatchOf(working, batch.id),
      proposed,
      approved,
      joined,
      skipped: submitted
        .filter(({ check }) => check.kind !== "new" && check.kind !== "inVera")
        .map(({ item }) => ({ type: item.type, value: item.value, unit: item.unit })),
    },
  };
}
function appendRequest(writes: SubmissionWrites, request: Request): void {
  writes.requests.push(request);
}
// Asking for work already moving follows it; asking while it is undecided waits with the others
// (LC-REQ-join).
function joiningRequestOf(
  record: DocumentRecord,
  base: Omit<Extract<Request, { decision: "Pending" }>, "decision" | "isAfterProjectApproval">,
): Request {
  const current = currentIterationOf(record);
  if (current === null || isAttemptOver(current))
    return { ...base, decision: "Pending", isAfterProjectApproval: false };
  return { ...base, decision: "Duplicate", tracksIterationId: current.id };
}
// The copies the check observes: a registry that holds a scan, and VERA's own earlier one.
export function existingCopiesFor(record: DocumentRecord, now: string): ExistingCopy[] {
  const registries = record.document.registryRecords
    .filter((entry) => entry.state === "Digitized" || entry.state === "Published")
    .map(
      (entry): ExistingCopy => ({
        source: entry.registry,
        state: entry.state,
        link: entry.url,
        iterationId: null,
        seenAt: now,
        foundAfterApproval: false,
      }),
    );
  const earlier = record.iterations
    .filter((iteration) => isProgressAtLeast(iteration.progress, "Digitized"))
    .map(
      (iteration): ExistingCopy => ({
        source: "VERA",
        state: iteration.progress === "Published" ? "Published" : "Digitized",
        link: primaryLinkOf(iteration)?.url ?? null,
        iterationId: iteration.id,
        seenAt: now,
        foundAfterApproval: false,
      }),
    );
  return [...registries, ...earlier];
}

// DOC-existing-copy: store the registry's answer with the moment it was checked.
function withRegistryAnswers(
  document: Document,
  answers: readonly RegistryAnswer[],
  now: Date,
): Document {
  if (answers.length === 0) return document;
  const observedAt = now.toISOString();
  const byRegistry = new Map(document.registryRecords.map((entry) => [entry.registry, entry]));
  for (const answer of answers)
    byRegistry.set(answer.registry, {
      registry: answer.registry,
      state: answer.state,
      rawState: null,
      linkKind: answer.link === null ? null : "content",
      url: answer.link,
      observedAt,
      checkedAt: observedAt,
      error: null,
    });
  return { ...document, registryRecords: [...byRegistry.values()] };
}

// LC-REQ-checks-job: the mock runs the queued check and optional approval plan, as the backend's job does.
export function planProposalCheck(
  store: RecordStore,
  plugins: ProposalPlugins,
  requestId: string,
  now: Date,
  newId: (prefix: "IT") => string,
): {
  documents: Document[];
  iterations: Iteration[];
  requests: Request[];
  events: EventEntryInput[];
} | null {
  const request = store.requests.find(({ id }) => id === requestId);
  if (
    request === undefined ||
    (request.decision !== "Pending" && request.decision !== "Duplicate") ||
    request.checkedAt !== null
  )
    return null;
  const document = store.documents.find(({ id }) => id === request.documentId);
  if (document === undefined) return null;
  const catalogRecord = knownCatalogRecords(store, plugins).find(
    ({ catalogId }) => catalogId === document.catalogId,
  );
  const checkedDocument =
    catalogRecord === undefined
      ? document
      : withRegistryAnswers(
          document,
          plugins.registryLookup(catalogRecord, document.unit?.value ?? null),
          now,
        );
  const record = { ...recordOf(store, document), document: checkedDocument };
  const nowIso = now.toISOString();
  const copies = existingCopiesFor(record, nowIso);
  const checked = { ...request, existingCopies: copies, checkedAt: nowIso };
  const writes: {
    documents: Document[];
    iterations: Iteration[];
    requests: Request[];
    events: EventEntryInput[];
  } = {
    documents: [checkedDocument],
    iterations: [],
    requests: [checked],
    events: [],
  };
  const approval = request.approvalAfterCheck;
  if (approval !== undefined && approval !== null && copies.length === 0) {
    const iterationId = newId("IT");
    const iteration: Iteration = {
      id: iterationId,
      documentId: document.id,
      attempt: record.iterations.length + 1,
      requestId: request.id,
      categoryId: approval.categoryId,
      priority: approval.priority,
      projectId: request.projectId,
      progress: "Enqueued",
      listId: null,
      formerListName: null,
      cancellation: null,
      restriction: null,
      restrictionOverride: null,
      defects: [],
      verdicts: [],
      ingestFailure: null,
      digitizedAt: null,
      links: [],
      scanDpi: null,
      properties: [],
    };
    writes.iterations.push(iteration);
    writes.requests[0] = {
      ...checked,
      decision: "Approved",
      iteration: { relation: "Originates", id: iterationId },
      rescan: null,
    };
    writes.events.push({
      subjectKind: "request",
      subjectId: request.id,
      at: nowIso,
      actor: { kind: "user", userId: request.requesterId },
      correlationId: crypto.randomUUID(),
      code: "request.approved",
      data: { iterationId, isRescan: false, batchSize: null, suggestion: null },
      reason: { public: null, internal: null },
    });
  }
  return writes;
}
function createdEvent(
  request: Request,
  batch: StoredBatch,
  correlationId: string,
): EventEntryInput {
  return {
    subjectKind: "request",
    subjectId: request.id,
    at: request.at,
    actor: { kind: "user", userId: request.requesterId },
    correlationId,
    code: "request.created",
    data: {
      batch: { id: batch.id, name: batch.name },
      source:
        batch.source == null ? null : { id: batch.source.instanceId, name: batch.source.name },
    },
    reason: { public: request.reason, internal: null },
  };
}
