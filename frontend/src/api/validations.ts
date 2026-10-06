// The Documents Validations resource (view-map.md §2.3): one row per iteration in the caller's
// category custody, or everywhere with `validation.*@any`, whose metadata a defect holds or that
// a rule forbade; one iteration with its history; and the verdicts on it. A verdict names exactly
// the defect keys it covers (status-model.md §2): Accept takes the outstanding set as it stands,
// Deny the ones ruled substantial with what every asker reads, Revoke the acceptances back.
// There are no bulk verdicts: each is a judgement on one record's evidence.

import { z } from "zod";
import { findJson, getJson, postJson } from "@/api/http";
import { apiRoutes, validationRoute, verdictRoute } from "@/api/routes";
import type { Priority } from "@/domain/entities";
import { prioritySchema, progressSchema, statusLogEntrySchema } from "@/domain/entities";
import type { ReviewState } from "@/domain/validations";
import { reviewStateSchema, validationRowSchema } from "@/domain/validations";
import type { ValueRange } from "@/lib/value-range";
import { formatRange, parseDay, parseRange } from "@/lib/value-range";

// ---------------------------------------------------------------- query

// Each list matches any of its values; the fields together match all of them (filtering.md §2).
export interface ValidationQuery {
  readonly search?: string;
  readonly reviews?: readonly ReviewState[];
  readonly categoryIds?: readonly string[];
  // The plugin that found a defect still to rule on.
  readonly plugins?: readonly string[];
  readonly priorities?: readonly Priority[];
  readonly projectIds?: readonly string[];
  // Advanced, a range rather than values (filtering.md §6): the day it started waiting.
  readonly waiting?: ValueRange<string>;
}

export type ValidationRangeField = "waiting";
export type ValidationListField = Exclude<keyof ValidationQuery, "search" | ValidationRangeField>;

// Query-string names; the same names address the filter in the page URL.
export const validationQueryParams = {
  search: "q",
  reviews: "review",
  categoryIds: "category",
  plugins: "defect",
  priorities: "priority",
  projectIds: "project",
  waiting: "since",
} as const satisfies Record<keyof ValidationQuery, string>;

const idValueSchema = z.string().min(1);

const validationFieldSchemas = {
  reviews: reviewStateSchema,
  categoryIds: idValueSchema,
  plugins: idValueSchema,
  priorities: prioritySchema,
  projectIds: idValueSchema,
} as const satisfies Record<ValidationListField, z.ZodType<string>>;

const listFields = Object.keys(validationFieldSchemas) as ValidationListField[];
const listSeparator = ",";

export function toValidationSearchParams(query: ValidationQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(validationQueryParams.search, search);
  }

  for (const field of listFields) {
    const values = query[field];
    if (values === undefined || values.length === 0) {
      continue;
    }

    params.set(validationQueryParams[field], values.toSorted().join(listSeparator));
  }

  const waiting = formatRange(query.waiting);
  if (waiting !== null) {
    params.set(validationQueryParams.waiting, waiting);
  }

  return params;
}

// Unknown or malformed values are dropped, so a stale link still opens the view.
export function parseValidationSearchParams(params: URLSearchParams): ValidationQuery {
  const query: Record<string, unknown> = {
    search: params.get(validationQueryParams.search)?.trim() || undefined,
  };
  for (const field of listFields) {
    const raw = params.get(validationQueryParams[field]) ?? "";
    const values = raw.split(listSeparator).flatMap((value) => {
      const parsed = validationFieldSchemas[field].safeParse(value.trim());
      return parsed.success ? [parsed.data] : [];
    });
    query[field] = values.length === 0 ? undefined : [...new Set(values)];
  }

  query.waiting = parseRange(params.get(validationQueryParams.waiting), parseDay);

  // Every value of each field was parsed by that field's own schema.
  return query as ValidationQuery;
}

// True when the two name the same filter, however their lists are ordered.
export function isSameValidationQuery(first: ValidationQuery, second: ValidationQuery): boolean {
  const canonical = (query: ValidationQuery) => {
    const params = toValidationSearchParams(query);
    params.sort();
    return params.toString();
  };

  return canonical(first) === canonical(second);
}

// ---------------------------------------------------------------- slices

export const validationSliceParams = { cursor: "cursor", limit: "limit" } as const;
export const validationSliceSize = 50;
export const maximumValidationSliceSize = 200;

export function parseValidationSliceParams(params: URLSearchParams): {
  cursor: string | null;
  limit: number;
} {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(maximumValidationSliceSize)
    .safeParse(params.get(validationSliceParams.limit) ?? undefined);
  return {
    cursor: params.get(validationSliceParams.cursor) || null,
    limit: limit.success ? limit.data : validationSliceSize,
  };
}

// ---------------------------------------------------------------- responses

function facetCountsOf<Value extends z.ZodType>(value: Value) {
  return z.array(z.object({ value, count: z.number().int() }));
}

export const validationPageSchema = z.object({
  items: z.array(validationRowSchema),
  // Rows matching the whole filter, across every slice, and the defects on them still to rule on.
  total: z.number().int(),
  outstandingTotal: z.number().int(),
  nextCursor: z.string().nullable(),
  // Each field's values with a match, counted over every other active filter.
  facets: z.object({
    reviews: facetCountsOf(reviewStateSchema),
    categoryIds: facetCountsOf(z.string()),
    plugins: facetCountsOf(z.string()),
    priorities: facetCountsOf(prioritySchema),
    projectIds: facetCountsOf(z.string()),
  } satisfies Record<ValidationListField, z.ZodType>),
});
export type ValidationPage = z.infer<typeof validationPageSchema>;

export const validationDetailSchema = z.object({
  row: validationRowSchema,
  // Where the record opens in the library's catalog, to repair it there; null when the catalog
  // adapter gives none.
  catalogLink: z.url().nullable(),
  // Newest first.
  log: z.array(statusLogEntrySchema),
});
export type ValidationDetail = z.infer<typeof validationDetailSchema>;

// ---------------------------------------------------------------- verdicts

// The outstanding set as the curator saw it; a set that changed meanwhile is refused (409).
export const acceptanceSchema = z.object({
  defectKeys: z.array(idValueSchema).min(1),
  note: z.string().trim().min(1).nullable(),
});
export type Acceptance = z.infer<typeof acceptanceSchema>;

export const denialSchema = z.object({
  // The defects ruled substantial.
  defectKeys: z.array(idValueSchema).min(1),
  // Read by every asker, so it is about the document, never a motive.
  publicText: z.string().trim().min(1),
  internalText: z.string().trim().min(1).nullable(),
});
export type Denial = z.infer<typeof denialSchema>;

// The acceptances taken back; they are outstanding again.
export const revocationSchema = z.object({
  defectKeys: z.array(idValueSchema).min(1),
});
export type Revocation = z.infer<typeof revocationSchema>;

export const verdictResultSchema = z.object({
  iterationId: z.string(),
  // Where it stands now; null once nothing holds it here.
  review: reviewStateSchema.nullable(),
  progress: progressSchema,
  // How many askers a denial is sent to.
  askerCount: z.number().int(),
});
export type VerdictResult = z.infer<typeof verdictResultSchema>;

// ---------------------------------------------------------------- calls

interface ValidationListOptions {
  readonly cursor?: string | null;
  readonly limit?: number;
}

export async function listValidations(
  query: ValidationQuery,
  { cursor = null, limit = validationSliceSize }: ValidationListOptions = {},
): Promise<ValidationPage> {
  const params = toValidationSearchParams(query);
  if (cursor !== null) {
    params.set(validationSliceParams.cursor, cursor);
  }

  params.set(validationSliceParams.limit, String(limit));
  return getJson(apiRoutes.validations, validationPageSchema, params);
}

// Null when the iteration is not (or no longer) held here within the caller's custody.
export async function findValidation(iterationId: string): Promise<ValidationDetail | null> {
  return findJson(validationRoute(iterationId), validationDetailSchema);
}

export async function acceptDefects(
  iterationId: string,
  acceptance: Acceptance,
): Promise<VerdictResult> {
  return postJson(verdictRoute(iterationId, "accept"), acceptance, verdictResultSchema);
}

export async function denyDefects(iterationId: string, denial: Denial): Promise<VerdictResult> {
  return postJson(verdictRoute(iterationId, "deny"), denial, verdictResultSchema);
}

export async function revokeAcceptance(
  iterationId: string,
  revocation: Revocation,
): Promise<VerdictResult> {
  return postJson(verdictRoute(iterationId, "revoke"), revocation, verdictResultSchema);
}
