// The document read model: one row per document, with every attempt and every ask behind it.
// Earlier iterations live in the record, never as extra rows (view-map.md §2.1). A document
// with no iteration is shown through its requests until one is approved and ingested.

import { z } from "zod";
import type {
  Document,
  ExistingCopy,
  Iteration,
  PageSource,
  RegistryRecord,
  RegistryState,
  Request,
} from "@/domain/entities";
import { documentSchema, iterationSchema, registryStates, requestSchema } from "@/domain/entities";
import type { DisplayStatus, PublicStatus } from "@/domain/status";
import { decisionStatusOf, iterationStatusOf, publicStatusOf } from "@/domain/status";

// Who reads a record: staff in the internal vocabulary, a requester in the public one, about
// their own asks only (view-map.md §4).
export const audienceSchema = z.enum(["staff", "public"]);
export type Audience = z.infer<typeof audienceSchema>;

export const documentRecordSchema = z.object({
  document: documentSchema,
  // Oldest attempt first; the last one is current.
  iterations: z.array(iterationSchema),
  requests: z.array(requestSchema),
});
export type DocumentRecord = z.infer<typeof documentRecordSchema>;

export function currentIterationOf(record: DocumentRecord): Iteration | null {
  return record.iterations.at(-1) ?? null;
}

export function iterationOf(record: DocumentRecord, iterationId: string): Iteration | null {
  return record.iterations.find((iteration) => iteration.id === iterationId) ?? null;
}

// ---------------------------------------------------------------- requests

// The iteration a request produced or follows, if one exists yet.
export function followedIterationId(request: Request): string | null {
  if (request.decision === "Approved") {
    return request.iteration?.id ?? null;
  }

  return request.decision === "Duplicate" ? request.tracksIterationId : null;
}

// The askers of the current attempt; earlier iterations keep their own.
export function askersOf(record: DocumentRecord): Request[] {
  const current = currentIterationOf(record);
  if (current === null) {
    return record.requests;
  }

  return record.requests.filter(
    (request) => request.decision === "Pending" || followedIterationId(request) === current.id,
  );
}

// The ask a public record is read by (VIEW-documents-audience): the person's own latest, or, for
// a document they reach only through a project, the latest ask made into it. A public record
// holds only the asks its reader reaches.
export function latestPublicAskOf(record: DocumentRecord, userId: string): Request | undefined {
  return (
    requestsBy(record, userId)[0] ??
    record.requests.toSorted((first, second) => second.at.localeCompare(first.at))[0]
  );
}

export function requestsBy(record: DocumentRecord, userId: string): Request[] {
  return record.requests
    .filter((request) => request.requesterId === userId)
    .toSorted((first, second) => second.at.localeCompare(first.at));
}

// Every ask records the copies its check found; the same copy found twice is one copy.
export function existingCopiesOf(requests: readonly Request[]): ExistingCopy[] {
  const copies = new Map<string, ExistingCopy>();
  for (const copy of requests.flatMap((request) => request.existingCopies)) {
    copies.set(`${copy.source}-${copy.iterationId}`, copy);
  }

  return [...copies.values()];
}

// ---------------------------------------------------------------- status

// The decisions a person makes on an ask, liveliest first. Duplicate is set by the machine and
// follows other work, so it is never one of them.
export const askDecisions = ["Pending", "Approved", "Denied", "Withdrawn"] as const;
export const askDecisionSchema = z.enum(askDecisions);
export type AskDecision = z.infer<typeof askDecisionSchema>;

// Without an iteration a document's status is its liveliest request.
function leadDecisionOf(record: DocumentRecord): AskDecision | null {
  const decisions = new Set(record.requests.map((request) => request.decision));
  return askDecisions.find((decision) => decisions.has(decision)) ?? null;
}

export function recordStatusOf(record: DocumentRecord): DisplayStatus | null {
  const current = currentIterationOf(record);
  if (current !== null) {
    return iterationStatusOf(current);
  }

  const decision = leadDecisionOf(record);
  return decision === null ? null : decisionStatusOf(decision);
}

// What a requester sees for their most recent ask about this document.
export function publicRecordStatusOf(record: DocumentRecord, userId: string): PublicStatus | null {
  const latest = latestPublicAskOf(record, userId);
  if (latest === undefined) {
    return null;
  }

  const iterationId = followedIterationId(latest);
  const iteration = iterationId === null ? null : iterationOf(record, iterationId);
  return publicStatusOf(latest, iteration);
}

// ---------------------------------------------------------------- funding and provenance

// The iteration's project, or before approval the project its asks were made into.
export function projectIdOf(record: DocumentRecord): string | null {
  const current = currentIterationOf(record);
  if (current !== null) {
    return current.projectId;
  }

  return record.requests.find((request) => request.projectId !== null)?.projectId ?? null;
}

// The batch the current attempt came in on: its originating request's, or before approval the
// batch any ask came in on.
export function batchIdOf(record: DocumentRecord): string | null {
  const current = currentIterationOf(record);
  if (current !== null) {
    return record.requests.find((request) => request.id === current.requestId)?.batchId ?? null;
  }

  return record.requests.find((request) => request.batchId !== null)?.batchId ?? null;
}

// How far adding a document of a batch got, for the batch's header (decided 2026-10-06). Each
// document is in exactly one state, read off the status its row shows, so the header agrees with
// its rows and its parts add up to the batch: what is held at a gate (forbidden, waiting for
// review, denied in review) is not counted as being added.
export const additionStates = [
  "awaiting",
  "declined",
  "withdrawn",
  "forbidden",
  "reviewNeeded",
  "deniedInReview",
  "adding",
  "failed",
  "added",
  "cancelled",
] as const;
export type AdditionState = (typeof additionStates)[number];

export function additionStateOf(record: DocumentRecord): AdditionState | null {
  const status = recordStatusOf(record);
  if (status === null) {
    return null;
  }

  const states = {
    AwaitingReview: "awaiting",
    Declined: "declined",
    Withdrawn: "withdrawn",
    Forbidden: "forbidden",
    ReviewNeeded: "reviewNeeded",
    ValidationDenied: "deniedInReview",
    BeingAdded: "adding",
    Enqueued: "adding",
    IngestFailed: "failed",
    Ready: "added",
    Planned: "added",
    InProgress: "added",
    Digitized: "added",
    Published: "added",
    Cancelled: "cancelled",
    NotDigitizable: "cancelled",
  } as const satisfies Record<DisplayStatus, AdditionState>;

  return states[status];
}

// ---------------------------------------------------------------- catalog facts

// The highest tier that has a value wins (document-properties.md §4).
export function effectivePageCount(document: Document): PageSource | null {
  return document.pageSources.toSorted((first, second) => second.tier - first.tier)[0] ?? null;
}

const registryEvidenceRank = {
  CheckFailed: -1,
  NotFound: 0,
  Unmapped: 1,
  Planned: 2,
  InProgress: 3,
  Digitized: 4,
  Published: 5,
} as const satisfies Record<RegistryRecord["state"], number>;

// The strongest evidence of a copy elsewhere; a registry that found nothing is no evidence.
export function strongestRegistryRecord(document: Document): RegistryRecord | null {
  const found = document.registryRecords.filter((record) => record.state !== "NotFound");
  const ranked = found.toSorted(
    (first, second) => registryEvidenceRank[second.state] - registryEvidenceRank[first.state],
  );
  return ranked[0] ?? null;
}

// What the Existing copy filter matches: the state of the strongest evidence, or none at all.
export const existingCopyStates = [
  ...registryStates.filter((state) => state !== "NotFound"),
  "None",
] as const satisfies readonly (Exclude<RegistryState, "NotFound"> | "None")[];
export const existingCopyStateSchema = z.enum(existingCopyStates);
export type ExistingCopyState = z.infer<typeof existingCopyStateSchema>;

export function existingCopyStateOf(document: Document): ExistingCopyState {
  const strongest = strongestRegistryRecord(document);
  if (strongest === null || strongest.state === "NotFound") {
    return "None";
  }

  return strongest.state;
}

export function documentIdentifierOf(document: Document): string {
  return document.unit === null
    ? document.catalogId
    : `${document.catalogId} · ${document.unit.value}`;
}
