// The Documents Validations resource (view-map.md §2.3): one row per iteration in the caller's
// category custody, or everywhere with `validation.*@any`, whose metadata a defect holds or that
// a rule forbade; one iteration with its history; and the verdicts on it. A verdict names exactly
// the defect keys it covers (status-model.md §2): Accept takes the outstanding set as it stands,
// Deny the ones ruled substantial with what every asker reads, Revoke the acceptances back.
// There are no bulk verdicts: each is a judgement on one record's evidence.

import type { Priority } from "@vera/domain/entities";
import { prioritySchema, progressSchema, statusLogEntrySchema } from "@vera/domain/entities";
import type { ReviewedState } from "@vera/domain/validations";
import {
  reviewedStateSchema,
  reviewStateSchema,
  validationRowSchema,
} from "@vera/domain/validations";
import type { DayRange } from "@vera/domain/value-range";
import { formatDayRange, parseDayRange } from "@vera/domain/value-range";
import { z } from "zod";
import type { Answer } from "./documents";
import { answerSchema } from "./documents";
import { facetCountsOf } from "./facets";
import type { PropertyParams } from "./properties";
import {
  canonicalPropertyParams,
  propertyFacetsSchema,
  propertyParamsOf,
  writePropertyParams,
} from "./properties";

// ---------------------------------------------------------------- query

// Each list matches any of its values; the fields together match all of them (filtering.md §2).
export interface ValidationQuery {
  readonly search?: string;
  readonly reviews?: readonly ReviewedState[];
  // Whether a rule forbade it: Yes, No, or either.
  readonly forbidden?: readonly Answer[];
  readonly categoryIds?: readonly string[];
  // The instance that found a defect still to rule on.
  readonly instances?: readonly string[];
  readonly priorities?: readonly Priority[];
  readonly projectIds?: readonly string[];
  // Advanced, a range rather than values (filtering.md §6): the day it started waiting.
  readonly waiting?: DayRange;
  // DOC-property-filter: a condition per property, as `p.<key>` writes it.
  readonly properties?: PropertyParams;
}

export type ValidationRangeField = "waiting";

export type ValidationListField = Exclude<
  keyof ValidationQuery,
  "search" | "properties" | ValidationRangeField
>;

// Query-string names; the same names address the filter in the page URL.
export const validationQueryParams = {
  search: "q",
  reviews: "review",
  forbidden: "forbidden",
  categoryIds: "category",
  instances: "defect",
  priorities: "priority",
  projectIds: "project",
  waiting: "since",
  properties: "p.",
} as const satisfies Record<keyof ValidationQuery, string>;

const idValueSchema = z.string().min(1);

const validationFieldSchemas = {
  reviews: reviewedStateSchema,
  forbidden: answerSchema,
  categoryIds: idValueSchema,
  instances: idValueSchema,
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

  const waiting = formatDayRange(query.waiting);
  if (waiting !== null) {
    params.set(validationQueryParams.waiting, waiting);
  }

  writePropertyParams(params, query.properties);
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

  query.waiting = parseDayRange(params.get(validationQueryParams.waiting));
  query.properties = propertyParamsOf(params);

  // Every value of each field was parsed by that field's own schema.
  return query as ValidationQuery;
}

// True when the two name the same filter, however their lists are ordered.
export function isSameValidationQuery(first: ValidationQuery, second: ValidationQuery): boolean {
  const canonical = (query: ValidationQuery) => {
    const params = toValidationSearchParams({ ...query, properties: undefined });
    params.sort();
    return `${params.toString()}&${canonicalPropertyParams(query.properties)}`;
  };

  return canonical(first) === canonical(second);
}

// ---------------------------------------------------------------- grouping

// How the rows may be grouped; presentation, never part of the filter or a watchlist
// (filtering.md §3.4). By the item's category, or by the instance of the defects still to rule on.
export const validationGroupings = ["category", "defect"] as const;

export const validationGroupingSchema = z.enum(validationGroupings);

export type ValidationGrouping = z.infer<typeof validationGroupingSchema>;

export const validationGroupingParam = "group";

export function parseValidationGrouping(params: URLSearchParams): ValidationGrouping | null {
  const grouping = validationGroupingSchema.safeParse(params.get(validationGroupingParam));
  return grouping.success ? grouping.data : null;
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

// The defect group of a row whose defects to rule on come from more than one instance.
export const severalInstances = "several";

const groupCounts = {
  // Rows of the group matching the whole filter, across every slice.
  total: z.number().int(),
  // How many of this slice's rows, next in order, fall into the group.
  rowCount: z.number().int(),
};

// A group header. By defect, a row whose defects to rule on come from several instances is filed
// under none of them but under "several", and one with none to rule on (forbidden, or accepted)
// under null: a row is in one group only.
export const validationGroupSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("category"), categoryId: z.string(), ...groupCounts }),
  z.object({
    kind: z.literal("defect"),
    instanceId: z.union([z.string(), z.literal(severalInstances)]).nullable(),
    ...groupCounts,
  }),
]);

export type ValidationGroup = z.infer<typeof validationGroupSchema>;

export const validationPageSchema = z.object({
  items: z.array(validationRowSchema),
  // Rows matching the whole filter, across every slice, and the defects on them still to rule on.
  total: z.number().int(),
  outstandingTotal: z.number().int(),
  nextCursor: z.string().nullable(),
  // When grouped, the groups this slice's rows fall into, in order; empty otherwise.
  groups: z.array(validationGroupSchema),
  // Each field's values with a match, counted over every other active filter.
  facets: z.object({
    reviews: facetCountsOf(reviewedStateSchema),
    forbidden: facetCountsOf(answerSchema),
    categoryIds: facetCountsOf(z.string()),
    instances: facetCountsOf(z.string()),
    priorities: facetCountsOf(prioritySchema),
    projectIds: facetCountsOf(z.string()),
  } satisfies Record<ValidationListField, z.ZodType>),
  propertyFacets: propertyFacetsSchema,
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
