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
import { hasPermission } from "@/domain/permissions";
import { isProgressAtLeast, publicIterationStatusOf } from "@/domain/status";
import { database } from "@/mocks/database";
import { audienceOf } from "@/mocks/documents";
import type { CatalogRecord } from "@/mocks/fixtures/catalog";
import { catalogRecords } from "@/mocks/fixtures/catalog";

export const proposalSettings: ProposalSettings = { maxAtOnce: 10, canDetectTypes: true };

// The most one proposal may hold for the caller: unlimited for a curator adding a shelf.
export function proposalLimitOf(session: Session): number {
  return hasPermission(session, "request.decide")
    ? Number.POSITIVE_INFINITY
    : proposalSettings.maxAtOnce;
}

// The projects the caller may propose into: a member's, and not Rejected (projects.md §4).
export function proposableProjectsOf(session: Session): Project[] {
  return database.projects.filter(
    (project) => project.state !== "Rejected" && project.memberIds.includes(session.user.id),
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
  const document = findDocument(record.catalogId, resolution.unit);
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
  const records = [...catalogRecords, ...heldCatalogRecords()];
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

// The documents VERA already holds answer for their catalog IDs, units and barcodes.
function heldCatalogRecords(): CatalogRecord[] {
  const byCatalogId = new Map<string, Document[]>();
  for (const document of database.documents) {
    byCatalogId.set(document.catalogId, [...(byCatalogId.get(document.catalogId) ?? []), document]);
  }

  return [...byCatalogId].map(([catalogId, documents]) => {
    const units = documents.flatMap((document) =>
      document.unit === null ? [] : [document.unit.value],
    );
    const barcodes = documents.flatMap((document) =>
      document.unit?.type === "barcode" ? [[document.unit.value, document.unit.value]] : [],
    );
    const [first] = documents;
    return {
      catalogId,
      title: first?.title ?? catalogId,
      type: first?.type ?? "Monograph",
      units: units.length === 0 ? null : units,
      identifiers: [],
      barcodes: Object.fromEntries(barcodes),
    };
  });
}

function findDocument(catalogId: string, unit: string | null): Document | null {
  return (
    database.documents.find(
      (document) => document.catalogId === catalogId && (document.unit?.value ?? null) === unit,
    ) ?? null
  );
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
        ? (findDocument(check.catalogId, check.unit) ?? createDocument(check.catalogId, check.unit))
        : findDocument(check.catalogId, check.unit);
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
  const record = [...catalogRecords, ...heldCatalogRecords()].find(
    (candidate) => candidate.catalogId === catalogId,
  );
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

function unitTypeOf(unit: string): NonNullable<Document["unit"]>["type"] {
  if (/^MZK-\d{4}-\d{6}$/.test(unit)) {
    return "barcode";
  }

  return /^(roč\.|sv\.|vol\.)\s*\d+/.test(unit) ? "volume-number" : "volume-name";
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
