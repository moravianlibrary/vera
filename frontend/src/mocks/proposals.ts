// What the server does when someone proposes: check each item against the catalog, then against
// the documents VERA holds, and on submit turn what checked out into requests, one batch when
// there are several (view-map.md §1, propose; status-model.md §2.7–2.8). An item is resolved
// again on submit; what the dialog was told is never trusted.

import type { RecordStatus } from "@/api/documents";
import type {
  ProposalCheck,
  ProposalDraft,
  ProposalItem,
  ProposalReport,
  ProposalSettings,
  RateLimitStatus,
} from "@/api/proposals";
import type { DocumentRecord } from "@/domain/documents";
import { currentIterationOf, recordStatusOf } from "@/domain/documents";
import type {
  Batch,
  Document,
  ExistingCopy,
  Iteration,
  Project,
  Request,
  Session,
} from "@/domain/entities";
import { isProjectMember } from "@/domain/projects";
import { isProgressAtLeast, publicIterationStatusOf } from "@/domain/status";
import { findDocumentByIdentity, knownCatalogRecords, unitTypeOf } from "@/mocks/catalog";
import { database } from "@/mocks/database";
import { audienceOf } from "@/mocks/documents";
import type { CatalogRecord } from "@/mocks/fixtures/catalog";

// The mock library's calendar day is Prague time. Both proposal limits belong to roles.
const canDetectTypes = true;

// Track submission timestamps per user for rate limiting.
// Keyed by user ID, each entry is an array of ISO timestamps.
const submissionLog: Record<string, string[]> = {};

function roleProposalLimitOf(
  session: Session,
  field: "proposalBatchLimit" | "proposalDailyLimit",
): number | null {
  const limits = database.roles
    .filter(
      (role) =>
        session.roleIds.includes(role.id) &&
        role.grants.some((grant) => grant.permission === "request.create"),
    )
    .map((role) => role[field]);
  if (limits.includes(null)) return null;
  return Math.max(0, ...limits.filter((limit): limit is number => limit !== null));
}

export function proposalSettingsOf(session: Session): ProposalSettings {
  return { maxAtOnce: proposalLimitOf(session), canDetectTypes };
}

export function proposalLimitOf(session: Session): number | null {
  return roleProposalLimitOf(session, "proposalBatchLimit");
}

function dailyLimitOf(session: Session): number | null {
  return roleProposalLimitOf(session, "proposalDailyLimit");
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

// Count accepted items submitted on the library's current calendar day.
function submissionCountToday(session: Session, now: Date): number {
  const logs = submissionLog[session.user.id] ?? [];
  const today = libraryDayOf(now);
  return logs.filter((ts) => libraryDayOf(new Date(ts)) === today).length;
}

// The remaining rate limit count for the current user (what they can still submit).
export function getRateLimitStatus(session: Session): RateLimitStatus {
  const limit = dailyLimitOf(session);
  return {
    perDay: limit === null ? null : Math.max(0, limit - submissionCountToday(session, new Date())),
  };
}

// Check if the user can submit `count` more items today.
export function canSubmitRateLimited(session: Session, count: number): boolean {
  const limit = dailyLimitOf(session);
  return limit === null || submissionCountToday(session, new Date()) + count <= limit;
}

// Record a submission for rate limiting tracking.
function recordSubmission(session: Session, itemCount: number): void {
  const now = new Date().toISOString();
  if (!submissionLog[session.user.id]) {
    submissionLog[session.user.id] = [];
  }
  // Record one timestamp per item (so we track volume, not just submission count).
  for (let i = 0; i < itemCount; i++) {
    submissionLog[session.user.id].push(now);
  }
}

// The projects the caller may propose into: a member's, and not Rejected (projects.md §4).
export function proposableProjectsOf(session: Session): Project[] {
  return database.projects.filter(
    (project) =>
      project.state !== "Rejected" && isProjectMember(project, session.user.id, session.groupIds),
  );
}

// ---------------------------------------------------------------- check

interface Resolved {
  record: CatalogRecord;
  unit: string | null;
}

type Resolution = Resolved | { units: readonly string[]; record: CatalogRecord } | null;

export function checkItem(session: Session, item: ProposalItem): ProposalCheck {
  const resolution = resolve(item);
  if (resolution === null) {
    return { kind: "notInCatalog" };
  }

  const { record } = resolution;
  if ("units" in resolution) {
    return {
      kind: "whichUnit",
      catalogId: record.catalogId,
      title: record.title,
      units: [...resolution.units],
    };
  }

  const found = {
    catalogId: record.catalogId,
    unit: resolution.unit,
    title: resolution.unit === null ? record.title : `${record.title} · ${resolution.unit}`,
  };
  const document = findDocumentByIdentity(record.catalogId, resolution.unit);
  if (document === null) {
    return { kind: "new", ...found, isAskedBefore: false };
  }

  const held = recordOf(document);
  if (isAskedBy(held, session.user.id)) {
    return { kind: "mine", ...found, documentId: document.id };
  }

  if (!isLive(held)) {
    return { kind: "new", ...found, isAskedBefore: held.requests.length > 0 };
  }

  return { kind: "inVera", ...found, documentId: document.id, status: statusFor(session, held) };
}

// The quota counts requests actually made, including joining an existing document.
// Items that the submit report will skip do not consume it.
export function submittableProposalItemCount(session: Session, draft: ProposalDraft): number {
  return draft.items.filter((item) => {
    const kind = checkItem(session, item).kind;
    return kind === "new" || kind === "inVera";
  }).length;
}

// The catalog's answer: a record, and the unit when the record has several.
function resolve(item: ProposalItem): Resolution {
  const record = catalogRecordOf(item);
  if (record === null) {
    return null;
  }

  const barcodeUnit = item.type === "barcode" ? record.barcodes[item.value] : undefined;
  if (barcodeUnit !== undefined) {
    return { record, unit: barcodeUnit };
  }

  if (record.units === null) {
    return { record, unit: null };
  }

  if (item.unit !== null && record.units.includes(item.unit)) {
    return { record, unit: item.unit };
  }

  // One unit is no choice to make.
  const [onlyUnit] = record.units;
  if (record.units.length === 1 && onlyUnit !== undefined && item.unit === null) {
    return { record, unit: onlyUnit };
  }

  return { record, units: record.units };
}

function catalogRecordOf(item: ProposalItem): CatalogRecord | null {
  const records = knownCatalogRecords();
  const normalized = (value: string) => value.replaceAll("-", "").toLowerCase();

  const record = records.find((candidate) => {
    switch (item.type) {
      case "catalogId":
        return candidate.catalogId === item.value.toUpperCase();
      case "barcode":
        return item.value in candidate.barcodes;
      default:
        return candidate.identifiers.some(
          (identifier) => normalized(identifier) === normalized(item.value),
        );
    }
  });
  return record ?? null;
}

function recordOf(document: Document): DocumentRecord {
  return {
    document,
    iterations: database.iterations
      .filter((iteration) => iteration.documentId === document.id)
      .toSorted((first, second) => first.attempt - second.attempt),
    requests: database.requests.filter((request) => request.documentId === document.id),
  };
}

// Work is moving: an attempt exists, or a decision every asker waits on.
function isLive(record: DocumentRecord): boolean {
  return (
    record.iterations.length > 0 ||
    record.requests.some((request) => request.decision === "Pending")
  );
}

function isAskedBy(record: DocumentRecord, userId: string): boolean {
  return record.requests.some(
    (request) =>
      request.requesterId === userId &&
      (request.decision === "Pending" ||
        request.decision === "Approved" ||
        request.decision === "Duplicate"),
  );
}

function statusFor(session: Session, record: DocumentRecord): RecordStatus {
  const current = currentIterationOf(record);
  if (audienceOf(session) === "staff") {
    return recordStatusOf(record) ?? "AwaitingReview";
  }

  return current === null ? "WaitingForReview" : publicIterationStatusOf(current);
}

// ---------------------------------------------------------------- submit

export function submitProposal(session: Session, draft: ProposalDraft): ProposalReport {
  const now = new Date().toISOString();
  const project = database.projects.find((candidate) => candidate.id === draft.projectId);
  const submitted = draft.items.map((item) => ({ item, check: checkItem(session, item) }));
  const accepted = submitted.filter(({ check }) => check.kind === "new" || check.kind === "inVera");
  const batch = accepted.length > 1 ? createBatch(session, draft, now) : null;

  let proposed = 0;
  let approved = 0;
  let joined = 0;
  for (const { item, check } of accepted) {
    if (check.kind !== "new" && check.kind !== "inVera") {
      continue;
    }

    const document =
      check.kind === "new"
        ? (findDocumentByIdentity(check.catalogId, check.unit) ??
          createDocument(check.catalogId, check.unit))
        : findDocumentByIdentity(check.catalogId, check.unit);
    if (document === null) {
      continue;
    }

    const base = {
      id: `R-${crypto.randomUUID()}`,
      documentId: document.id,
      requesterId: session.user.id,
      at: now,
      reason: item.reason ?? draft.reason,
      batchId: batch?.id ?? null,
      projectId: project?.id ?? null,
      existingCopies: existingCopiesOf(recordOf(document), now),
      checkedAt: now,
    };

    if (check.kind === "inVera") {
      database.requests.push(joiningRequestOf(recordOf(document), base));
      joined += 1;
      continue;
    }

    proposed += 1;
    if (draft.approval !== null && base.existingCopies.length === 0) {
      approve(base, document, draft.approval);
      approved += 1;
      continue;
    }

    database.requests.push({
      ...base,
      decision: "Pending",
      // With a copy found, approval asked for waits for a curator: it would be a rescan.
      approveOnCheck: draft.approval === null ? null : { actorId: session.user.id, at: now },
      isAfterProjectApproval: project?.state === "Approved",
    });
  }

  // Record submissions for rate limiting (after all items are processed).
  const acceptedCount = accepted.length;
  if (acceptedCount > 0) {
    recordSubmission(session, acceptedCount);
  }

  return {
    batch,
    proposed,
    approved,
    joined,
    skipped: submitted
      .filter(({ check }) => check.kind !== "new" && check.kind !== "inVera")
      .map(({ item }) => ({ type: item.type, value: item.value, unit: item.unit })),
  };
}

type RequestBase = Omit<
  Extract<Request, { decision: "Pending" }>,
  "decision" | "approveOnCheck" | "isAfterProjectApproval"
>;

// Asking for work already moving follows it; asking while it is undecided waits with the others.
function joiningRequestOf(record: DocumentRecord, base: RequestBase): Request {
  const current = currentIterationOf(record);
  if (current === null) {
    return { ...base, decision: "Pending", approveOnCheck: null, isAfterProjectApproval: false };
  }

  return { ...base, decision: "Duplicate", tracksIterationId: current.id };
}

function approve(
  base: RequestBase,
  document: Document,
  approval: NonNullable<ProposalDraft["approval"]>,
): void {
  const iteration: Iteration = {
    id: `IT-${crypto.randomUUID()}`,
    documentId: document.id,
    attempt: recordOf(document).iterations.length + 1,
    requestId: base.id,
    categoryId: approval.categoryId,
    priority: approval.priority,
    projectId: base.projectId,
    progress: "Enqueued",
    listId: null,
    formerListName: null,
    restriction: null,
    restrictionOverride: null,
    cancellation: null,
    defects: [],
    verdicts: [],
    ingestFailure: null,
    digitizedAt: null,
    publishedLink: null,
    scanDpi: null,
  };
  database.iterations.push(iteration);
  database.requests.push({
    ...base,
    decision: "Approved",
    iteration: { relation: "Originates", id: iteration.id },
    rescan: null,
  });
}

// The copies the check observes: a registry that holds a scan, and VERA's own earlier one.
function existingCopiesOf(record: DocumentRecord, now: string): ExistingCopy[] {
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
        link: iteration.publishedLink,
        iterationId: iteration.id,
        seenAt: now,
        foundAfterApproval: false,
      }),
    );
  return [...registries, ...earlier];
}

function createDocument(catalogId: string, unit: string | null): Document {
  const record = knownCatalogRecords().find((candidate) => candidate.catalogId === catalogId);
  const document: Document = {
    id: `D-${crypto.randomUUID()}`,
    catalogId,
    unit: unit === null ? null : { type: unitTypeOf(unit), value: unit },
    title: record?.title ?? catalogId,
    type: record?.type ?? "Monograph",
    signature: null,
    pageSources: [],
    registryRecords: [],
  };
  database.documents.push(document);
  return document;
}

function createBatch(session: Session, draft: ProposalDraft, now: string): Batch {
  const highest = Math.max(
    0,
    ...database.batches.map((batch) => Number(batch.id.replace(/^B-/, "")) || 0),
  );
  const batch: Batch = {
    id: `B-${String(highest + 1).padStart(4, "0")}`,
    name: draft.batchName ?? `proposals-${now.slice(0, 10)}`,
    via: draft.via,
    submittedBy: session.user.id,
    submittedAt: now,
  };
  database.batches.push(batch);
  return batch;
}
