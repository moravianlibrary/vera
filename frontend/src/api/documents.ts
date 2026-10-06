// The Documents resource: one row per document within the caller's reach, and one document's
// full record with its history. The server decides the reach and the audience: with
// `iteration.read` the caller sees every document in the staff vocabulary; with only
// `request.read_own` they see their own asks in the public vocabulary (navigation.md §1.1).

import { z } from "zod";
import { findJson, getJson } from "@/api/http";
import { apiRoutes, documentRoute } from "@/api/routes";
import type { AskDecision, ExistingCopyState } from "@/domain/documents";
import {
  askDecisionSchema,
  audienceSchema,
  documentRecordSchema,
  existingCopyStateSchema,
} from "@/domain/documents";
import type { Priority, Progress } from "@/domain/entities";
import {
  batchSchema,
  prioritySchema,
  progressSchema,
  projectSchema,
  statusLogEntrySchema,
} from "@/domain/entities";
import type { PublicStatus, Validation } from "@/domain/status";
import { displayStatuses, publicStatuses, validations } from "@/domain/status";
import type { DayRange, ValueRange } from "@/lib/value-range";
import {
  formatDayRange,
  formatRange,
  parseCount,
  parseDayRange,
  parseRange,
} from "@/lib/value-range";

// A display status for staff, a public status for a requester.
export const recordStatusSchema = z.enum([...new Set([...displayStatuses, ...publicStatuses])]);
export type RecordStatus = z.infer<typeof recordStatusSchema>;

// ---------------------------------------------------------------- query

// The answers to a yes-or-no field, as a list so that either, both or neither can be picked.
export const answers = ["Yes", "No"] as const;
export const answerSchema = z.enum(answers);
export type Answer = z.infer<typeof answerSchema>;

export const publicStatusSchema = z.enum(publicStatuses);
export const validationSchema = z.enum(validations);

// Each list matches any of its values; the fields together match all of them (filtering.md §2).
export interface DocumentQuery {
  readonly search?: string;
  // A requester's one field: their own ask's status, in the public vocabulary.
  readonly statuses?: readonly PublicStatus[];
  // Narrows a staff reach to documents the caller asked for.
  readonly isMine?: boolean;
  // The stored dimensions a staff status is derived from (status-model.md §1). A document holds
  // the decisions of its current askers; the rest belong to its current iteration, so a
  // document with none yet holds no progress, validation, restriction or cancellation.
  readonly decisions?: readonly AskDecision[];
  readonly progress?: readonly Progress[];
  readonly validations?: readonly Validation[];
  readonly forbidden?: readonly Answer[];
  readonly cancelled?: readonly Answer[];
  // A category matches its whole subtree.
  readonly categoryIds?: readonly string[];
  readonly projectIds?: readonly string[];
  readonly priorities?: readonly Priority[];
  readonly existingCopies?: readonly ExistingCopyState[];
  readonly askerIds?: readonly string[];
  // Advanced, ranges rather than values (filtering.md §6): the page count in use, and the day
  // any current asker asked.
  readonly pages?: ValueRange<number>;
  readonly asked?: DayRange;
}

// The fields that are lists of values, each counted as a facet.
export type DocumentListField = Exclude<
  keyof DocumentQuery,
  "search" | "isMine" | DocumentRangeField
>;
export type DocumentRangeField = "pages" | "asked";

// Query-string names; the same names address the filter in the page URL.
export const documentQueryParams = {
  search: "q",
  statuses: "status",
  isMine: "mine",
  decisions: "decision",
  progress: "progress",
  validations: "validation",
  forbidden: "forbidden",
  cancelled: "cancelled",
  categoryIds: "category",
  projectIds: "project",
  priorities: "priority",
  existingCopies: "copy",
  askerIds: "asker",
  pages: "pages",
  asked: "asked",
} as const satisfies Record<keyof DocumentQuery, string>;

const mineValue = "1";
const listSeparator = ",";
const idValueSchema = z.string().min(1);

const listFields = [
  "statuses",
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
] as const satisfies readonly DocumentListField[];

export function toDocumentSearchParams(query: DocumentQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(documentQueryParams.search, search);
  }

  if (query.isMine === true) {
    params.set(documentQueryParams.isMine, mineValue);
  }

  for (const field of listFields) {
    const values = query[field];
    if (values !== undefined && values.length > 0) {
      params.set(documentQueryParams[field], values.join(listSeparator));
    }
  }

  const pages = formatRange(query.pages);
  if (pages !== null) {
    params.set(documentQueryParams.pages, pages);
  }

  const asked = formatDayRange(query.asked);
  if (asked !== null) {
    params.set(documentQueryParams.asked, asked);
  }

  return params;
}

// Unknown or malformed values are dropped, so a stale link still opens the view.
export function parseDocumentSearchParams(params: URLSearchParams): DocumentQuery {
  const listOf = <Value extends string>(field: DocumentListField, schema: z.ZodType<Value>) => {
    const raw = params.get(documentQueryParams[field]) ?? "";
    const values = raw.split(listSeparator).flatMap((value) => {
      const parsed = schema.safeParse(value.trim());
      return parsed.success ? [parsed.data] : [];
    });
    return values.length === 0 ? undefined : [...new Set(values)];
  };

  return {
    search: params.get(documentQueryParams.search)?.trim() || undefined,
    statuses: listOf("statuses", publicStatusSchema),
    isMine: params.get(documentQueryParams.isMine) === mineValue || undefined,
    decisions: listOf("decisions", askDecisionSchema),
    progress: listOf("progress", progressSchema),
    validations: listOf("validations", validationSchema),
    forbidden: listOf("forbidden", answerSchema),
    cancelled: listOf("cancelled", answerSchema),
    categoryIds: listOf("categoryIds", idValueSchema),
    projectIds: listOf("projectIds", idValueSchema),
    priorities: listOf("priorities", prioritySchema),
    existingCopies: listOf("existingCopies", existingCopyStateSchema),
    askerIds: listOf("askerIds", idValueSchema),
    pages: parseRange(params.get(documentQueryParams.pages), parseCount),
    asked: parseDayRange(params.get(documentQueryParams.asked)),
  };
}

// True when the two name the same filter, however their lists are ordered.
export function isSameDocumentQuery(first: DocumentQuery, second: DocumentQuery): boolean {
  const canonical = (query: DocumentQuery) => {
    const params = toDocumentSearchParams(query);
    for (const field of listFields) {
      const values = query[field];
      if (values !== undefined && values.length > 0) {
        params.set(documentQueryParams[field], values.toSorted().join(listSeparator));
      }
    }

    params.sort();
    return params.toString();
  };

  return canonical(first) === canonical(second);
}

// ---------------------------------------------------------------- grouping

// How the rows are arranged. Not a filter: it keeps every row and is not saved in a watchlist
// (filtering.md §3.4). Batches need `addition.read`; without it the server does not group by
// batch, and a requester's list is never grouped.
export const documentGroupings = ["batch", "project"] as const;
export const documentGroupingSchema = z.enum(documentGroupings);
export type DocumentGrouping = z.infer<typeof documentGroupingSchema>;

export const documentGroupingParam = "group";

export function parseDocumentGrouping(params: URLSearchParams): DocumentGrouping | null {
  const grouping = documentGroupingSchema.safeParse(params.get(documentGroupingParam));
  return grouping.success ? grouping.data : null;
}

// ---------------------------------------------------------------- slices

// The list arrives a slice at a time. A cursor is opaque: null asks for the first slice, and
// each slice names the cursor of the next one. Not part of the page URL, which names the filter.
export interface DocumentSlice {
  readonly cursor: string | null;
  readonly limit?: number;
}

export const documentSliceParams = { cursor: "cursor", limit: "limit" } as const;

export const documentSliceSize = 50;
export const maximumDocumentSliceSize = 200;

export function parseDocumentSliceParams(params: URLSearchParams): Required<DocumentSlice> {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(maximumDocumentSliceSize)
    .safeParse(params.get(documentSliceParams.limit) ?? undefined);
  return {
    cursor: params.get(documentSliceParams.cursor) || null,
    limit: limit.success ? limit.data : documentSliceSize,
  };
}

// ---------------------------------------------------------------- responses

function facetCountsOf<Value extends z.ZodType>(value: Value) {
  return z.array(z.object({ value, count: z.number().int() }));
}

const groupCounts = {
  // Rows of the group matching the whole filter, across every slice.
  total: z.number().int(),
  // How many of this slice's rows, next in order, fall into the group.
  rowCount: z.number().int(),
};

// A group header. A null batch or project gathers the rows that have none.
export const documentGroupSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("batch"),
    batch: batchSchema.nullable(),
    // Every document of the batch within reach, filtered or not, and how far its addition got:
    // added (Ready or later), being added (Enqueued, a retry too), failed, and awaiting a decision
    // (asked for, with no iteration yet), and denied (every ask declined before an iteration).
    size: z.number().int(),
    awaiting: z.number().int(),
    added: z.number().int(),
    adding: z.number().int(),
    failed: z.number().int(),
    denied: z.number().int(),
    ...groupCounts,
  }),
  z.object({ kind: z.literal("project"), project: projectSchema.nullable(), ...groupCounts }),
]);
export type DocumentGroup = z.infer<typeof documentGroupSchema>;

export const documentPageSchema = z.object({
  audience: audienceSchema,
  // One slice of the rows, in the list's order.
  items: z.array(documentRecordSchema),
  // Rows matching the whole filter, across every slice.
  total: z.number().int(),
  // Null on the last slice.
  nextCursor: z.string().nullable(),
  // When grouped, the groups this slice's rows fall into, in order; empty otherwise. The rows
  // are sorted by group first, so a group spans consecutive rows and maybe several slices.
  groups: z.array(documentGroupSchema),
  // Each field's values with a match, counted over every other active filter. A field the
  // audience does not have is empty: a requester has only the status, staff everything else.
  facets: z.object({
    statuses: facetCountsOf(publicStatusSchema),
    decisions: facetCountsOf(askDecisionSchema),
    progress: facetCountsOf(progressSchema),
    validations: facetCountsOf(validationSchema),
    forbidden: facetCountsOf(answerSchema),
    cancelled: facetCountsOf(answerSchema),
    categoryIds: facetCountsOf(z.string()),
    projectIds: facetCountsOf(z.string()),
    priorities: facetCountsOf(prioritySchema),
    existingCopies: facetCountsOf(existingCopyStateSchema),
    askerIds: facetCountsOf(z.string()),
  } satisfies Record<DocumentListField, z.ZodType>),
});
export type DocumentPage = z.infer<typeof documentPageSchema>;

export const documentDetailSchema = z.object({
  audience: audienceSchema,
  record: documentRecordSchema,
  // Newest first.
  log: z.array(statusLogEntrySchema),
});
export type DocumentDetail = z.infer<typeof documentDetailSchema>;

interface DocumentListOptions extends Partial<DocumentSlice> {
  readonly grouping?: DocumentGrouping | null;
}

export async function listDocuments(
  query: DocumentQuery,
  { grouping = null, cursor = null, limit = documentSliceSize }: DocumentListOptions = {},
): Promise<DocumentPage> {
  const params = toDocumentSearchParams(query);
  if (grouping !== null) {
    params.set(documentGroupingParam, grouping);
  }

  if (cursor !== null) {
    params.set(documentSliceParams.cursor, cursor);
  }

  params.set(documentSliceParams.limit, String(limit));
  return getJson(apiRoutes.documents, documentPageSchema, params);
}

// Null when the document does not exist or lies outside the caller's reach.
export async function findDocument(documentId: string): Promise<DocumentDetail | null> {
  return findJson(documentRoute(documentId), documentDetailSchema);
}
