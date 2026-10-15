// Domain entities as transport schemas, with the TypeScript types inferred from them.
// The API layer parses every response through these, so the rest of the app works with trusted
// values. Shapes follow docs/design/shared/entities/ (concepts, relationships, status-model):
// a document is the item, an iteration one attempt at it, a request one ask for it. The four
// status axes stay separate; the displayed status is derived in ./status.ts, never stored here.

import { z } from "zod";
import { grantSchema } from "@/domain/permissions";

const id = z.string().min(1);
const timestamp = z.iso.datetime();
const calendarDate = z.iso.date();

// A reason shown to two audiences (view-rules §4.3). The internal text is withheld (null) from
// callers who may only read the public one.
const reasonTexts = {
  publicText: z.string(),
  internalText: z.string().nullable(),
};

// Who did something. `undisclosed` is what a reader sees for staff acts on their request.
export const actorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: id }),
  z.object({ kind: z.literal("system") }),
  z.object({ kind: z.literal("undisclosed") }),
]);
export type Actor = z.infer<typeof actorSchema>;

const actedBy = {
  actorId: id,
  at: timestamp,
};

// ---------------------------------------------------------------- people and access

export const userSchema = z.object({
  id,
  name: z.string(),
  // An agent is a plugin that proposes like a person and never signs in.
  kind: z.enum(["person", "agent"]),
  email: z.string().nullable(),
});
export type User = z.infer<typeof userSchema>;

export const sessionSchema = z.object({
  user: userSchema,
  roleIds: z.array(id),
  grants: z.array(grantSchema),
  // Category custody, inherited downward; `custody`-scoped grants apply inside it.
  custodyCategoryIds: z.array(id),
  // A group brings custody and project membership (permissions.md §1).
  groupIds: z.array(id),
});
export type Session = z.infer<typeof sessionSchema>;

// Who sees and decides a proposal before it has a category (proposal-custody.md): a name with
// members. Which proposals are in one is the Custody plugins' answer; what none placed is in the
// one fallback.
export const requestCustodySchema = z.object({
  id,
  name: z.string(),
  description: z.string(),
  isFallback: z.boolean(),
});
export type RequestCustody = z.infer<typeof requestCustodySchema>;

// ---------------------------------------------------------------- classification and funding

export const categorySchema = z.object({
  id,
  name: z.string(),
  parentId: id.nullable(),
});
export type Category = z.infer<typeof categorySchema>;

export const priorities = ["Low", "Normal", "High", "Urgent"] as const;
export const prioritySchema = z.enum(priorities);
export type Priority = z.infer<typeof prioritySchema>;

const projectBase = {
  id,
  name: z.string(),
  description: z.string(),
  startsOn: calendarDate,
  endsOn: calendarDate,
  managerId: id,
  // People, the manager among them, and groups whose people are members while they are in it.
  memberIds: z.array(id),
  memberGroupIds: z.array(id),
  createdAt: timestamp,
};

// Decision state is stored and final once decided; the period (upcoming, active, ended) is
// derived from the dates (projects.md §1). It has no target: that is its intention's (§1.1).
export const projectSchema = z.discriminatedUnion("state", [
  z.object({ ...projectBase, state: z.literal("Proposed") }),
  z.object({ ...projectBase, state: z.literal("Approved"), priority: prioritySchema, ...actedBy }),
  z.object({ ...projectBase, state: z.literal("Rejected"), reason: z.string(), ...actedBy }),
]);
export type Project = z.infer<typeof projectSchema>;

// ---------------------------------------------------------------- intentions

// Independent mix, including immutable revisions and optional labels on preserved snapshots.
export const mixRevisionSchema = z.object({
  revision: z.number().int().positive(),
  shares: z.record(z.string(), z.number().min(0).max(100)),
  at: timestamp,
  label: z.string().nullable(),
});
export type MixRevision = z.infer<typeof mixRevisionSchema>;

export const distributionSchema = z.object({
  id,
  // Legacy intention owner; independent mixes have no owning intention.
  ownerId: id.nullable(),
  name: z.string().min(1),
  isPrimary: z.boolean(),
  archivedAt: timestamp.nullable(),
  // Percent by category ID; a category without an entry has no share.
  shares: z.record(z.string(), z.number().min(0).max(100)),
  revision: z.number().int().positive(),
  revisions: z.array(mixRevisionSchema),
});
export type Distribution = z.infer<typeof distributionSchema>;

// Which items an intention counts: any, those funded by no project, or one project's.
export const intentionFundingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("any") }),
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("project"), projectId: id }),
]);
export type IntentionFunding = z.infer<typeof intentionFundingSchema>;

// A scope and an objective, never a container: an item counts towards every intention whose
// scope it matches (intentions.md §3). With a target it has progress; without one it tracks the
// mix. Every intention counts from a date, locked once created; a project's own intention counts
// over the project's period, which the server reads from the project.
export const intentionSchema = z.object({
  id,
  name: z.string(),
  description: z.string(),
  funding: intentionFundingSchema,
  // The project it was made with, as that project's own intention (§3.4): its name, funding and
  // window are the project's and follow it, and it lives and dies with it.
  projectId: id.nullable(),
  // One category node with its subtree; null is every category.
  scopeCategoryId: id.nullable(),
  // The intention whose mix this one reads; null when it owns its mix. Never one that tracks.
  tracksMixOf: id.nullable(),
  // The mix in use: its own, or the tracked owner's.
  distributionId: id.nullable(),
  // Null or absent follows the latest revision; a number pins an immutable one.
  mixRevision: z.number().int().positive().nullable().optional(),
  targetPages: z.number().int().positive().nullable(),
  countsFrom: calendarDate,
  // The last day counted; null for open-ended.
  endsOn: calendarDate.nullable(),
  // Exactly one: everything, no target, no end, the default mix for generating (§3.1).
  isOverall: z.boolean(),
  // The repeat that made it.
  templateId: id.nullable(),
  // Hides it; counting goes on (§3.3). A repeat archives the previous occurrence itself.
  archived: z.object({ actor: actorSchema, at: timestamp }).nullable(),
});
export type Intention = z.infer<typeof intentionSchema>;

export const repeatEverySchema = z.enum(["week", "month", "quarter"]);
export type RepeatEvery = z.infer<typeof repeatEverySchema>;

// A repeat makes one intention per period, each with its own window (intentions.md §3.3).
export const intentionTemplateSchema = z.object({
  id,
  // "Monthly output — {period}".
  namePattern: z.string(),
  every: repeatEverySchema,
  funding: intentionFundingSchema,
  scopeCategoryId: id.nullable(),
  tracksMixOf: id.nullable(),
  distributionId: id.nullable(),
  mixRevision: z.number().int().positive().nullable().optional(),
  targetPages: z.number().int().positive().nullable(),
  // Archiving the previous occurrence only hides it.
  isArchivingPrevious: z.boolean(),
  since: calendarDate,
  nextOn: calendarDate,
  createdBy: id,
});
export type IntentionTemplate = z.infer<typeof intentionTemplateSchema>;

// What a list was generated with: provenance, never what it counts towards (intentions.md §5).
export const listGenerationSchema = z.object({
  intentionId: id,
  mixId: id.nullable().optional(),
  // The revision of the mix it read, since a shared mix changes after (§5).
  mixRevision: z.number().int().positive().nullable(),
  pages: z.number().int().nonnegative(),
  // A correcting run's pages per category, accepted before generating; none when the mix decided.
  allocation: z.record(z.string(), z.number().int().nonnegative()).nullable(),
  // Plugin and version: "PriorityFirst 1.2.0".
  generator: z.string(),
  at: timestamp,
});
export type ListGeneration = z.infer<typeof listGenerationSchema>;

export const digitizationListSchema = z.object({
  id,
  name: z.string(),
  startsOn: calendarDate,
  endsOn: calendarDate,
  targetPages: z.number().int().nonnegative().nullable(),
  // Provenance of a generated list; a hand-built list has none.
  generated: listGenerationSchema.nullable(),
  createdBy: id,
  createdAt: timestamp,
  done: z.object(actedBy).nullable(),
});
export type DigitizationList = z.infer<typeof digitizationListSchema>;

// A person's or an agent's submission, named by them; how each item came in is not kept
// (ENT-batch).
export const batchSchema = z.object({
  id,
  name: z.string(),
  submittedBy: id,
  submittedAt: timestamp,
  // How many requests the submission made: one item is a batch too, shown as one only from two
  // (ENT-batch).
  size: z.number().int().positive(),
});
export type Batch = z.infer<typeof batchSchema>;

// ---------------------------------------------------------------- documents

export const pageSourceSchema = z.object({
  source: z.enum(["manual", "catalog", "predictor"]),
  // The highest tier with a value is the page count in use (document-properties.md §4).
  tier: z.number().int(),
  value: z.number().int().nonnegative(),
  observedAt: timestamp,
  setBy: id.nullable(),
});
export type PageSource = z.infer<typeof pageSourceSchema>;

export const registryStates = [
  "CheckFailed",
  "NotFound",
  "Unmapped",
  "Planned",
  "InProgress",
  "Digitized",
  "Published",
] as const;
export const registryStateSchema = z.enum(registryStates);
export type RegistryState = z.infer<typeof registryStateSchema>;

// Evidence from an external registry, not VERA state (registry-status.md).
export const registryRecordSchema = z.object({
  registry: z.string(),
  state: registryStateSchema,
  rawState: z.string().nullable(),
  // `content` links to the scan, `record` to someone else's bookkeeping.
  linkKind: z.enum(["content", "record"]).nullable(),
  url: z.url().nullable(),
  observedAt: timestamp,
  checkedAt: timestamp,
  error: z.string().nullable(),
});
export type RegistryRecord = z.infer<typeof registryRecordSchema>;

export const documentTypeSchema = z.enum(["Periodical", "Monograph", "Manuscript", "Map"]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

// Identity is the catalog ID plus, for one part of a larger record, the unit
// (document-identity.md).
export const documentSchema = z.object({
  id,
  catalogId: z.string(),
  unit: z
    .object({
      type: z.enum(["volume-name", "volume-number", "barcode"]),
      value: z.string(),
    })
    .nullable(),
  title: z.string(),
  type: documentTypeSchema,
  // Where the copy stands in the library, read from the catalog (DOC-identifiers).
  shelfMark: z.string().nullable(),
  pageSources: z.array(pageSourceSchema),
  registryRecords: z.array(registryRecordSchema),
});
export type Document = z.infer<typeof documentSchema>;

// ---------------------------------------------------------------- iterations

export const progressValues = [
  "Enqueued",
  "IngestFailed",
  "Ready",
  "Planned",
  "InProgress",
  "Digitized",
  "Published",
] as const;
export const progressSchema = z.enum(progressValues);
export type Progress = z.infer<typeof progressSchema>;

export const restrictionSchema = z.object({
  rule: z.string(),
  ...reasonTexts,
  foundAt: timestamp,
});
export type Restriction = z.infer<typeof restrictionSchema>;

// TODO(rrandiak): the cause RecordGone (status-model.md §2.5, decided 2026-10-06) is set by the
// catalog sync, not a person, so it waits for the sync and an actor that is not a user.
export const cancellationSchema = z.object({
  cause: z.enum(["Decided", "NotDigitizable"]),
  ...actedBy,
  ...reasonTexts,
});
export type Cancellation = z.infer<typeof cancellationSchema>;

// A finding that makes metadata not good enough to digitize against. `key` is stable across
// check runs: plugin instance, rule code and subject, never the value (status-model.md §2).
export const defectSchema = z.object({
  key: z.string(),
  plugin: z.string(),
  ruleCode: z.string(),
  subject: z.string(),
  ...reasonTexts,
  firstSeenAt: timestamp,
});
export type Defect = z.infer<typeof defectSchema>;

// Append-only: a verdict covers exactly the defect keys ruled on in one act. A revocation takes
// back the acceptances it names, as a row of its own, so the table is never rewritten.
// TODO(rrandiak): status-model.md §2 lists only Approved and Denied; confirm Revoked as a row.
export const verdicts = ["Approved", "Denied", "Revoked"] as const;
export const validationVerdictSchema = z.object({
  defectKeys: z.array(z.string()).min(1),
  verdict: z.enum(verdicts),
  ...actedBy,
  // Internal: why, for staff.
  note: z.string(),
  // What every asker reads about a denial; null for the other verdicts.
  publicText: z.string().nullable(),
});
export type ValidationVerdict = z.infer<typeof validationVerdictSchema>;

export const iterationSchema = z.object({
  id,
  documentId: id,
  // 1 for the first attempt; a rescan is the next attempt at the same document.
  attempt: z.number().int().positive(),
  // The request that originated it; it is the only one whose project funds it.
  requestId: id,
  categoryId: id,
  priority: prioritySchema,
  projectId: id.nullable(),
  progress: progressSchema,
  listId: id.nullable(),
  // A deleted list survives only by name, as provenance.
  formerListName: z.string().nullable(),
  restriction: restrictionSchema.nullable(),
  restrictionOverride: z.object({ ...actedBy, note: z.string() }).nullable(),
  cancellation: cancellationSchema.nullable(),
  defects: z.array(defectSchema),
  verdicts: z.array(validationVerdictSchema),
  ingestFailure: z
    .object({
      attempts: z.number().int().positive(),
      // Withheld from callers without `request.read_ingest`.
      error: z.string().nullable(),
    })
    .nullable(),
  digitizedAt: timestamp.nullable(),
  publishedLink: z.url().nullable(),
  scanDpi: z.number().int().positive().nullable(),
});
export type Iteration = z.infer<typeof iterationSchema>;

// ---------------------------------------------------------------- requests

export const existingCopySchema = z.object({
  source: z.string(),
  state: registryStateSchema,
  link: z.url().nullable(),
  // Set when the copy is VERA's own earlier iteration.
  iterationId: id.nullable(),
  seenAt: timestamp,
  // A copy that appeared after approval was never decided over: a warning, not a rescan.
  foundAfterApproval: z.boolean(),
});
export type ExistingCopy = z.infer<typeof existingCopySchema>;

const requestBase = {
  id,
  documentId: id,
  requesterId: id,
  at: timestamp,
  reason: z.string().nullable(),
  // Every submission is a batch, one item included (ENT-batch).
  batchId: id,
  projectId: id.nullable(),
  existingCopies: z.array(existingCopySchema),
  // Null until restriction and copy checks have run once.
  checkedAt: timestamp.nullable(),
};

// Proposal and addition are phases of a request, not other entities (concepts.md §Request).
export const requestSchema = z.discriminatedUnion("decision", [
  z.object({
    ...requestBase,
    decision: z.literal("Pending"),
    // Proposed into a project after the project itself was approved.
    isAfterProjectApproval: z.boolean(),
  }),
  z.object({
    ...requestBase,
    decision: z.literal("Approved"),
    // Null in the window between approval and ingest.
    iteration: z
      .object({
        relation: z.enum(["Originates", "Tracks"]),
        id,
      })
      .nullable(),
    // Approved over an existing copy.
    rescan: z.object({ ...actedBy, note: z.string() }).nullable(),
  }),
  z.object({
    ...requestBase,
    decision: z.literal("Denied"),
    decline: z.object({ ...actedBy, ...reasonTexts }),
  }),
  z.object({
    ...requestBase,
    decision: z.literal("Withdrawn"),
    withdrawnAt: timestamp,
  }),
  z.object({
    ...requestBase,
    // Machine-set: work had already started, so this request follows it.
    decision: z.literal("Duplicate"),
    tracksIterationId: id,
  }),
]);
export type Request = z.infer<typeof requestSchema>;
export type Decision = Request["decision"];

// ---------------------------------------------------------------- history

// Causes, never derivations (status-log.md). One log across entities.
export const statusLogEntrySchema = z.object({
  id,
  subjectKind: z.enum(["iteration", "request", "list", "project"]),
  subjectId: id,
  at: timestamp,
  actor: actorSchema,
  correlationId: z.string(),
  // TODO(rrandiak): replace free-text events with event codes once the log contract exists.
  event: z.string(),
  // Withheld from callers who may only see what happened, not why.
  detail: z.string().nullable(),
});
export type StatusLogEntry = z.infer<typeof statusLogEntrySchema>;

// ---------------------------------------------------------------- watchlists

export const watchlistViewSchema = z.enum([
  "documents",
  "my-documents",
  "requests",
  "validations",
  "lists",
  "projects",
  "categories",
  "intentions",
  "tasks",
]);
export type WatchlistView = z.infer<typeof watchlistViewSchema>;

// Who sees a watchlist (filtering.md §4.5, decided 2026-10-06): its owner alone, everyone who
// opens the view, or the members of some groups and the holders of some roles (by hand or
// mapped) as one union. Every audience stops at who may open the view. Only those who manage
// shared watchlists set any audience but personal.
export const watchlistAudienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("personal") }),
  z.object({ kind: z.literal("everyone") }),
  z.object({ kind: z.literal("some"), groupIds: z.array(id), roleIds: z.array(id) }),
]);
export type WatchlistAudience = z.infer<typeof watchlistAudienceSchema>;

export function isShared({ audience }: { audience: WatchlistAudience }): boolean {
  return audience.kind !== "personal";
}

// A saved filter over one view. Grouping is presentation and is never part of it.
export const watchlistSchema = z.object({
  id,
  name: z.string().min(1),
  view: watchlistViewSchema,
  audience: watchlistAudienceSchema,
  filter: z.record(z.string(), z.string()),
  createdAt: timestamp,
});
export type Watchlist = z.infer<typeof watchlistSchema>;
