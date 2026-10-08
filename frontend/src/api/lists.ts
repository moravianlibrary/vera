// The Digitization Lists resource (view-map.md §2.4): the lists within the caller's reach with
// what is on them, one list with its members and history, the pool a list draws from, and saving
// what the editor built. A list's state and its members' progress are the server's to work out
// from the dates (flows.md L1, L2); the client only shows them. The bare `/lists` stays the
// reference data other views name a list by.

import { z } from "zod";
import { facetCountsOf } from "@/api/facets";
import { deleteResource, findJson, getJson, postJson, putJson } from "@/api/http";
import { apiRoutes, digitizationListMemberRoute, digitizationListRoute } from "@/api/routes";
import {
  digitizationListSchema,
  documentSchema,
  existingCopySchema,
  iterationSchema,
  listGenerationSchema,
  statusLogEntrySchema,
} from "@/domain/entities";
import type { ListState } from "@/domain/lists";
import { listStateSchema, memberBlockerSchema } from "@/domain/lists";
import { generatorClassSchema } from "@/domain/plugins";
import type { DayRange } from "@/lib/value-range";
import { formatDayRange, parseDayRange } from "@/lib/value-range";

// ---------------------------------------------------------------- query

export interface ListQuery {
  readonly search?: string;
  readonly states?: readonly ListState[];
  readonly attention?: readonly ListAttention[];
  readonly runs?: DayRange;
}

export const listAttentions = ["Overdue", "Blocked", "ReviewNeeded", "LateCopy", "Empty"] as const;
export const listAttentionSchema = z.enum(listAttentions);
export type ListAttention = z.infer<typeof listAttentionSchema>;
export type ListListField = "states" | "attention";

// Query-string names; the same names address the filter in the page URL.
export const listQueryParams = {
  search: "q",
  states: "state",
  attention: "attention",
  runs: "runs",
} as const satisfies Record<keyof ListQuery, string>;

const listSeparator = ",";

export function toListSearchParams(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(listQueryParams.search, search);
  }

  if (query.states !== undefined && query.states.length > 0) {
    params.set(listQueryParams.states, query.states.join(listSeparator));
  }
  if (query.attention !== undefined && query.attention.length > 0) {
    params.set(listQueryParams.attention, query.attention.join(listSeparator));
  }
  const runs = formatDayRange(query.runs);
  if (runs !== null) {
    params.set(listQueryParams.runs, runs);
  }

  return params;
}

// Unknown or malformed values are dropped, so a stale link still opens the view.
export function parseListSearchParams(params: URLSearchParams): ListQuery {
  const raw = params.get(listQueryParams.states) ?? "";
  const states = raw.split(listSeparator).flatMap((value) => {
    const parsed = listStateSchema.safeParse(value.trim());
    return parsed.success ? [parsed.data] : [];
  });
  // Links made before the shared filter bar used ?show= for the same state choices.
  const legacyStates =
    raw === "" && params.get("show") === "current"
      ? (["Planned", "InProgress"] as const)
      : raw === "" && params.get("show") === "done"
        ? (["Done"] as const)
        : undefined;
  const attention = (params.get(listQueryParams.attention) ?? "")
    .split(listSeparator)
    .flatMap((value) => {
      const parsed = listAttentionSchema.safeParse(value.trim());
      return parsed.success ? [parsed.data] : [];
    });

  return {
    search: params.get(listQueryParams.search)?.trim() || undefined,
    states: states.length === 0 ? legacyStates : [...new Set(states)],
    attention: attention.length === 0 ? undefined : [...new Set(attention)],
    runs: parseDayRange(params.get(listQueryParams.runs)),
  };
}

// True when the two name the same filter, however their lists are ordered.
export function isSameListQuery(first: ListQuery, second: ListQuery): boolean {
  const canonical = (query: ListQuery) => {
    const params = toListSearchParams({
      ...query,
      states: query.states?.toSorted(),
      attention: query.attention?.toSorted(),
    });
    params.sort();
    return params.toString();
  };

  return canonical(first) === canonical(second);
}

// ---------------------------------------------------------------- slices

export const listSliceParams = { cursor: "cursor", limit: "limit" } as const;
export const listSliceSize = 50;
export const maximumListSliceSize = 200;

export function parseListSliceParams(params: URLSearchParams): {
  cursor: string | null;
  limit: number;
} {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(maximumListSliceSize)
    .safeParse(params.get(listSliceParams.limit) ?? undefined);
  return {
    cursor: params.get(listSliceParams.cursor) || null,
    limit: limit.success ? limit.data : listSliceSize,
  };
}

// ---------------------------------------------------------------- responses

const count = z.number().int().nonnegative();

// One list as the browse rows and the pane's head read it. Pages are each member's page count
// in use (document-properties.md §4); a member without one counts nothing.
export const listRowSchema = z.object({
  list: digitizationListSchema,
  state: listStateSchema,
  // Past its end and not marked Done.
  isOverdue: z.boolean(),
  itemCount: count,
  pages: count,
  // Digitized or published: what was delivered.
  scannedItemCount: count,
  scannedPages: count,
  // Members a gate stopped after listing (flows.md L11).
  blockedCount: count,
  // Members with a copy elsewhere that appeared after approval (flows.md L17).
  lateCopyCount: count,
  // Scanned members a new defect holds in review (flows.md P2).
  reviewNeededCount: count,
  notDigitizableCount: count,
  cancelledCount: count,
  // What it counts towards, Overall last; worked out from what is on it and when it starts.
  countsTowards: z.array(z.object({ id: z.string(), name: z.string(), isOverall: z.boolean() })),
  // The intention it was generated with, provenance only.
  generatedWith: z.object({ id: z.string(), name: z.string() }).nullable(),
});
export type ListRow = z.infer<typeof listRowSchema>;

// An iteration as a list or the pool shows it: on a list, or one it could take.
export const listItemSchema = z.object({
  iteration: iterationSchema,
  document: documentSchema,
  pages: count.nullable(),
  // When its originating request was made: the fair tie-break after priority.
  askedAt: z.iso.datetime(),
  blocker: memberBlockerSchema.nullable(),
  // A copy that appeared after approval: nobody decided over it.
  lateCopy: existingCopySchema.nullable(),
});
export type ListItem = z.infer<typeof listItemSchema>;

export const listPageSchema = z.object({
  items: z.array(listRowSchema),
  // Rows matching the whole filter.
  total: z.number().int(),
  nextCursor: z.string().nullable(),
  facets: z.object({
    states: facetCountsOf(listStateSchema),
    attention: facetCountsOf(listAttentionSchema),
  }),
});
export type ListPage = z.infer<typeof listPageSchema>;

// ---------------------------------------------------------------- intentions

// Where a list stands against intentions (intentions.md §5): worked out, never attached.
export const countsTowardsRowSchema = z.object({
  intentionId: z.string(),
  name: z.string(),
  isOverall: z.boolean(),
  itemCount: count,
  pages: count,
});
export type CountsTowardsRow = z.infer<typeof countsTowardsRowSchema>;

// One of the scope's categories: its share, the pages on the list in it, and its goal.
export const listMixRowSchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  share: z.number().nullable(),
  pages: count,
  goalPages: count.nullable(),
});
export type ListMixRow = z.infer<typeof listMixRowSchema>;

// The list's fill read against one intention's mix, inside its scope.
export const listMixSchema = z.object({
  intention: z.object({ id: z.string(), name: z.string() }),
  scope: z.string().nullable(),
  // Read against a correcting run's allocation rather than the shares.
  isAllocation: z.boolean(),
  rows: z.array(listMixRowSchema),
});
export type ListMix = z.infer<typeof listMixSchema>;

// An intention a draft can be shaped by: not archived, not ended. Overall first.
export const listShapeSchema = z.object({
  id: z.string(),
  name: z.string(),
  isOverall: z.boolean(),
  countsFrom: z.iso.date(),
  endsOn: z.iso.date().nullable(),
  scope: z.string().nullable(),
  funding: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("any") }),
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("project"), name: z.string() }),
  ]),
});
export type ListShape = z.infer<typeof listShapeSchema>;

const allocationSchema = z.record(z.string(), count);

// What the editor asks while it builds a list: what the draft counts towards from its start,
// what it would stop counting towards against the saved one (flows.md L10), and its fill read
// against the intention picked. No start means it starts now.
export const listReadingRequestSchema = z.object({
  listId: z.string().nullable(),
  startsOn: z.iso.date().nullable(),
  memberIds: z.array(z.string().min(1)),
  // Null reads it against Overall.
  intentionId: z.string().nullable(),
  targetPages: z.number().int().positive().nullable(),
  allocation: allocationSchema.nullable(),
});
export type ListReadingRequest = z.infer<typeof listReadingRequestSchema>;

export const listReadingSchema = z.object({
  startsOn: z.iso.date(),
  countsTowards: z.array(countsTowardsRowSchema),
  // Counted with the saved start and members, no longer with the draft's.
  stopsCountingTowards: z.array(z.object({ id: z.string(), name: z.string() })),
  mix: listMixSchema,
});
export type ListReading = z.infer<typeof listReadingSchema>;

export const listDetailSchema = z.object({
  row: listRowSchema,
  // Highest priority first, then the oldest ask.
  members: z.array(listItemSchema),
  // Newest first.
  log: z.array(statusLogEntrySchema),
  countsTowards: z.array(countsTowardsRowSchema),
  // Read against the intention it was generated with, else Overall.
  mix: listMixSchema,
});
export type ListDetail = z.infer<typeof listDetailSchema>;

// ---------------------------------------------------------------- the pool

// Every gate passed, Ready and on no list (status-model.md §3). A category matches its subtree.
export interface PoolQuery {
  readonly search?: string;
  readonly categoryId?: string;
}

export const poolQueryParams = { search: "q", categoryId: "category" } as const satisfies Record<
  keyof PoolQuery,
  string
>;

export function toPoolSearchParams(query: PoolQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(poolQueryParams.search, search);
  }

  if (query.categoryId) {
    params.set(poolQueryParams.categoryId, query.categoryId);
  }

  return params;
}

export function parsePoolSearchParams(params: URLSearchParams): PoolQuery {
  return {
    search: params.get(poolQueryParams.search)?.trim() || undefined,
    categoryId: params.get(poolQueryParams.categoryId) || undefined,
  };
}

export const poolPageSchema = z.object({
  items: z.array(listItemSchema),
  // Matching the whole filter: how many, and their pages.
  total: z.number().int(),
  pages: count,
  nextCursor: z.string().nullable(),
  // What review still holds back, so a short pool explains itself (decided 2026-09-26): approved
  // items a defect holds, by top-level category, and documents nobody has decided on yet.
  inReview: z.array(z.object({ categoryId: z.string(), itemCount: count, pages: count })),
  undecidedCount: count,
  // Ready but cancelled: not offered until someone resumes it.
  cancelledCount: count,
});
export type PoolPage = z.infer<typeof poolPageSchema>;

// ---------------------------------------------------------------- generating

// A configured list generator plugin instance (plugins.md §4.9). None configured, no Generate.
export const listGeneratorSchema = z.object({
  id: z.string(),
  // The instance: "Priority, then age".
  name: z.string(),
  // The plugin and its version: "PriorityFirst", "1.2.0".
  plugin: z.string(),
  version: z.string(),
  generatorClass: generatorClassSchema,
  description: z.string(),
  // How far over or under the pages it may land, as a fraction: lumpy page counts never hit it.
  tolerance: z.number().nonnegative(),
});
export type ListGenerator = z.infer<typeof listGeneratorSchema>;

// What a generator is given (intentions.md §4.1). The current members stay fixed: it tops up
// towards the pages. No categories means all of them. One intention shapes it, supplying the
// scope and the mix; a correcting run's allocation fixes the pages per category instead.
export const generationRequestSchema = z.object({
  generatorId: z.string().min(1),
  pages: z.number().int().positive(),
  // Top-level categories to draw from.
  categoryIds: z.array(z.string().min(1)),
  memberIds: z.array(z.string().min(1)),
  // Null shapes it by Overall.
  intentionId: z.string().nullable(),
  // By the categories the intention's mix is read across.
  allocation: allocationSchema.nullable(),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

// Why a category ends short (intentions.md §4.2 rule 2): left out of the categories asked for,
// what is ready would overshoot it, nothing more is ready, or the mix gives it no share.
export const shortfallCauses = ["leftOut", "overshoot", "noSupply", "unallocated"] as const;
export const shortfallCauseSchema = z.enum(shortfallCauses);
export type ShortfallCause = z.infer<typeof shortfallCauseSchema>;

// A draft, never a list (intentions.md §4.3): the picks, each with its reason, and the report.
export const generationDraftSchema = z.object({
  generator: listGeneratorSchema,
  shapedBy: z.object({ intentionId: z.string(), name: z.string() }),
  picks: z.array(z.object({ item: listItemSchema, reason: z.string() })),
  requestedPages: count,
  // The current members and the picks together.
  totalPages: count,
  // Picks made in a sibling's place because a category could not be filled.
  spreadCount: count,
  // Leaf categories, in tree order.
  shortfalls: z.array(
    z.object({
      categoryId: z.string(),
      pages: count,
      cause: shortfallCauseSchema,
      // Approved for it but still held in review: why a short category may fill later.
      inReviewCount: count,
    }),
  ),
  // What the list records once saved.
  provenance: listGenerationSchema,
});
export type GenerationDraft = z.infer<typeof generationDraftSchema>;

// ---------------------------------------------------------------- saving

// What the editor saves, the whole of it at once: the members are the set as it should be.
// No start date means it starts now. A generation drafted since the editor opened replaces the
// list's provenance; without one it stays as it was.
export const listDraftSchema = z
  .object({
    name: z.string().trim().min(1, "Name the list"),
    startsOn: z.iso.date().nullable(),
    endsOn: z.iso.date(),
    targetPages: z.number().int().positive().nullable(),
    memberIds: z.array(z.string().min(1)),
    generated: listGenerationSchema.optional(),
  })
  .refine((draft) => draft.startsOn === null || draft.endsOn >= draft.startsOn, {
    message: "It cannot end before it starts",
    path: ["endsOn"],
  });
export type ListDraft = z.infer<typeof listDraftSchema>;

// ---------------------------------------------------------------- acting on a list

// What marking it Done would do, counted by the server before it is done (flows.md L14): every
// member not yet scanned and not stopped moves to Digitized, the blocked ones among them too.
export const markDoneDryRunSchema = z.object({
  toDigitized: z.object({ itemCount: count, pages: count }),
  alreadyScannedCount: count,
  notDigitizableCount: count,
  // Blocked since listing and about to move anyway: perhaps never scanned.
  blocked: z.array(z.object({ iterationId: z.string(), title: z.string() })),
});
export type MarkDoneDryRun = z.infer<typeof markDoneDryRunSchema>;

// What deleting it would do to its members (flows.md L15, V14): back to the pool as Ready, back
// to Enqueued where a gate now fails, scanned ones keep their status, stopped ones stay held.
export const deletionDryRunSchema = z.object({
  toReady: z.object({ itemCount: count, pages: count }),
  toEnqueuedCount: count,
  scannedCount: count,
  heldCount: count,
});
export type DeletionDryRun = z.infer<typeof deletionDryRunSchema>;

// Could not be digitized (flows.md L13): a fact about the item, with a message every asker reads.
export const notDigitizableRequestSchema = z.object({
  message: z.string().trim().min(1, "Say what happened"),
});
export type NotDigitizableRequest = z.infer<typeof notDigitizableRequestSchema>;

// ---------------------------------------------------------------- calls

interface SliceOptions {
  readonly cursor?: string | null;
  readonly limit?: number;
}

function withSlice(
  params: URLSearchParams,
  { cursor = null, limit = listSliceSize }: SliceOptions,
) {
  if (cursor !== null) {
    params.set(listSliceParams.cursor, cursor);
  }

  params.set(listSliceParams.limit, String(limit));
  return params;
}

export async function listLists(query: ListQuery, slice: SliceOptions = {}): Promise<ListPage> {
  return getJson(
    apiRoutes.digitizationLists,
    listPageSchema,
    withSlice(toListSearchParams(query), slice),
  );
}

// Null when the list does not exist or lies outside the caller's reach.
export async function findList(listId: string): Promise<ListDetail | null> {
  return findJson(digitizationListRoute(listId), listDetailSchema);
}

export async function listPool(query: PoolQuery, slice: SliceOptions = {}): Promise<PoolPage> {
  return getJson(
    apiRoutes.digitizationListPool,
    poolPageSchema,
    withSlice(toPoolSearchParams(query), slice),
  );
}

export async function listGenerators(): Promise<ListGenerator[]> {
  return getJson(apiRoutes.listGenerators, z.array(listGeneratorSchema));
}

export async function listShapes(): Promise<ListShape[]> {
  return getJson(apiRoutes.listShapes, z.array(listShapeSchema));
}

export async function readList(request: ListReadingRequest): Promise<ListReading> {
  return postJson(apiRoutes.listReading, request, listReadingSchema);
}

export async function generateDraft(request: GenerationRequest): Promise<GenerationDraft> {
  return postJson(apiRoutes.listGeneration, request, generationDraftSchema);
}

export async function createList(draft: ListDraft): Promise<ListDetail> {
  return postJson(apiRoutes.digitizationLists, draft, listDetailSchema);
}

export async function saveList(listId: string, draft: ListDraft): Promise<ListDetail> {
  return putJson(digitizationListRoute(listId), draft, listDetailSchema);
}

export async function previewMarkDone(listId: string): Promise<MarkDoneDryRun> {
  return getJson(`${digitizationListRoute(listId)}/done`, markDoneDryRunSchema);
}

export async function markDone(listId: string): Promise<ListDetail> {
  return postJson(`${digitizationListRoute(listId)}/done`, {}, listDetailSchema);
}

export async function previewDeletion(listId: string): Promise<DeletionDryRun> {
  return getJson(`${digitizationListRoute(listId)}/deletion`, deletionDryRunSchema);
}

export async function deleteList(listId: string): Promise<void> {
  return deleteResource(digitizationListRoute(listId));
}

export async function markNotDigitizable(
  listId: string,
  iterationId: string,
  request: NotDigitizableRequest,
): Promise<ListDetail> {
  return postJson(
    `${digitizationListMemberRoute(listId, iterationId)}/not-digitizable`,
    request,
    listDetailSchema,
  );
}
