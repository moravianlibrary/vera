// The one catalogue of what can happen (EVENT-catalogue, DEC-0018): each code, its subject, and
// the destinations that take it. The wording is the client's (EVENT-wording).
import { z } from "zod";
import { type Actor, actorSchema, prioritySchema, registryStateSchema } from "./entities";

interface EventFlags {
  subject: string;
  history: boolean;
  hook: boolean;
  audit: boolean;
  isPublic: boolean;
  isDerived?: boolean;
}

// This catalogue is the shared authority for History, hooks and Audit (EVENT-catalogue).
export const eventCatalogue = {
  "request.created": { subject: "request", history: true, hook: true, audit: true, isPublic: true },
  "request.approved": {
    subject: "request",
    history: true,
    hook: true,
    audit: true,
    isPublic: true,
  },
  "request.declined": {
    subject: "request",
    history: true,
    hook: true,
    audit: true,
    isPublic: true,
  },
  "request.held": { subject: "request", history: true, hook: true, audit: true, isPublic: false },
  "request.withdrawn": {
    subject: "request",
    history: true,
    hook: false,
    audit: true,
    isPublic: true,
  },
  "request.ingest_retried": {
    subject: "request",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "iteration.ingested": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.ingest_failed": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.rechecked": {
    subject: "iteration",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "iteration.page_count_entered": {
    subject: "iteration",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "iteration.verdict_accepted": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.verdict_denied": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.verdict_revoked": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.restricted": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: true,
  },
  "iteration.restriction_overruled": {
    subject: "iteration",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "iteration.reclassified": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.cancelled": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: true,
  },
  "iteration.not_digitizable": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: true,
  },
  "iteration.resumed": {
    subject: "iteration",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "iteration.listed": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.unlisted": {
    subject: "iteration",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "iteration.digitized": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: true,
  },
  "iteration.published": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: true,
  },
  "iteration.link_added": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.link_changed": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.link_made_primary": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.link_removed": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "iteration.copy_found": {
    subject: "iteration",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "iteration.property_changed": {
    subject: "iteration",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "document.relinked": {
    subject: "document",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "document.property_changed": {
    subject: "document",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "document.registry_changed": {
    subject: "document",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "list.created": { subject: "list", history: true, hook: true, audit: true, isPublic: false },
  "list.renamed": { subject: "list", history: true, hook: false, audit: true, isPublic: false },
  "list.dates_moved": { subject: "list", history: true, hook: true, audit: true, isPublic: false },
  "list.members_changed": {
    subject: "list",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "list.started_early": {
    subject: "list",
    history: true,
    hook: true,
    audit: true,
    isPublic: false,
  },
  "list.started": {
    subject: "list",
    history: false,
    hook: true,
    audit: false,
    isPublic: false,
    isDerived: true,
  },
  "list.marked_done": { subject: "list", history: true, hook: true, audit: true, isPublic: false },
  "list.deleted": { subject: "list", history: true, hook: true, audit: true, isPublic: false },
  "project.created": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "project.details_changed": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "project.dates_changed": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "project.member_added": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "project.member_removed": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "project.manager_changed": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "project.approved": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "project.rejected": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "project.deleted": {
    subject: "project",
    history: true,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "run.finished": { subject: "run", history: false, hook: true, audit: false, isPublic: false },
  "run.failed": { subject: "run", history: false, hook: true, audit: false, isPublic: false },
  "user.created": { subject: "user", history: false, hook: false, audit: true, isPublic: false },
  "user.roles_changed": {
    subject: "user",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "user.groups_changed": {
    subject: "user",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "user.identity_linked": {
    subject: "user",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "user.identity_unlinked": {
    subject: "user",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "user.suspended": { subject: "user", history: false, hook: false, audit: true, isPublic: false },
  "user.restored": { subject: "user", history: false, hook: false, audit: true, isPublic: false },
  "group.created": { subject: "group", history: false, hook: false, audit: true, isPublic: false },
  "group.changed": { subject: "group", history: false, hook: false, audit: true, isPublic: false },
  "group.members_changed": {
    subject: "group",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "group.deleted": { subject: "group", history: false, hook: false, audit: true, isPublic: false },
  "role.created": { subject: "role", history: false, hook: false, audit: true, isPublic: false },
  "role.permissions_changed": {
    subject: "role",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "role.renamed": { subject: "role", history: false, hook: false, audit: true, isPublic: false },
  "role.deleted": { subject: "role", history: false, hook: false, audit: true, isPublic: false },
  "custody.created": {
    subject: "custody",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "custody.changed": {
    subject: "custody",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "custody.members_changed": {
    subject: "custody",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "custody.deleted": {
    subject: "custody",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "category.created": {
    subject: "category",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "category.renamed": {
    subject: "category",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "category.moved": {
    subject: "category",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "category.refined": {
    subject: "category",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "category.custody_changed": {
    subject: "category",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "category.deleted": {
    subject: "category",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "intention.created": {
    subject: "intention",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "intention.changed": {
    subject: "intention",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "intention.archived": {
    subject: "intention",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "intention.deleted": {
    subject: "intention",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "repeat.changed": {
    subject: "repeat",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "mix.created": { subject: "mix", history: false, hook: false, audit: true, isPublic: false },
  "mix.revised": { subject: "mix", history: false, hook: false, audit: true, isPublic: false },
  "mix.labelled": { subject: "mix", history: false, hook: false, audit: true, isPublic: false },
  "mix.made_primary": { subject: "mix", history: false, hook: false, audit: true, isPublic: false },
  "mix.archived": { subject: "mix", history: false, hook: false, audit: true, isPublic: false },
  "mix.deleted": { subject: "mix", history: false, hook: false, audit: true, isPublic: false },
  "plugin.uploaded": {
    subject: "plugin",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "plugin_instance.created": {
    subject: "plugin_instance",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "plugin_instance.reset": {
    subject: "plugin_instance",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "plugin_instance.configured": {
    subject: "plugin_instance",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "plugin_instance.disabled": {
    subject: "plugin_instance",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "plugin_instance.enabled": {
    subject: "plugin_instance",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "plugin_instance.upgraded": {
    subject: "plugin_instance",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "plugin_instance.default_role_changed": {
    subject: "plugin_instance",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "plugin_instance.deleted": {
    subject: "plugin_instance",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "hook.created": { subject: "hook", history: false, hook: false, audit: true, isPublic: false },
  "hook.changed": { subject: "hook", history: false, hook: false, audit: true, isPublic: false },
  "hook.paused": { subject: "hook", history: false, hook: false, audit: true, isPublic: false },
  "hook.resumed": { subject: "hook", history: false, hook: false, audit: true, isPublic: false },
  "hook.deleted": { subject: "hook", history: false, hook: false, audit: true, isPublic: false },
  "schedule.created": {
    subject: "schedule",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "schedule.changed": {
    subject: "schedule",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "schedule.paused": {
    subject: "schedule",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "schedule.resumed": {
    subject: "schedule",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "schedule.deleted": {
    subject: "schedule",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "property.defined": {
    subject: "property",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "property.changed": {
    subject: "property",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
  "property.deleted": {
    subject: "property",
    history: false,
    hook: false,
    audit: true,
    isPublic: false,
  },
} as const satisfies Record<string, EventFlags>;

// Codes stored on record History entries, in catalogue order.
export type EventCode = keyof typeof eventCatalogue;
export type HookEventCode = {
  [Code in EventCode]: (typeof eventCatalogue)[Code]["hook"] extends true ? Code : never;
}[EventCode];
export const hookEventCodes = Object.keys(eventCatalogue).filter(
  (code) => eventCatalogue[code as EventCode].hook,
) as [HookEventCode, ...HookEventCode[]];
export const historyCodes = [
  "request.created",
  "request.approved",
  "request.declined",
  "request.held",
  "request.withdrawn",
  "request.ingest_retried",
  "iteration.ingested",
  "iteration.ingest_failed",
  "iteration.rechecked",
  "iteration.page_count_entered",
  "iteration.verdict_accepted",
  "iteration.verdict_denied",
  "iteration.verdict_revoked",
  "iteration.restricted",
  "iteration.restriction_overruled",
  "iteration.reclassified",
  "iteration.cancelled",
  "iteration.not_digitizable",
  "iteration.resumed",
  "iteration.listed",
  "iteration.unlisted",
  "iteration.digitized",
  "iteration.published",
  "iteration.link_added",
  "iteration.link_changed",
  "iteration.link_made_primary",
  "iteration.link_removed",
  "iteration.copy_found",
  "iteration.property_changed",
  "document.relinked",
  "document.property_changed",
  "document.registry_changed",
  "list.created",
  "list.renamed",
  "list.dates_moved",
  "list.members_changed",
  "list.started_early",
  "list.marked_done",
  "list.deleted",
  "project.created",
  "project.details_changed",
  "project.dates_changed",
  "project.member_added",
  "project.member_removed",
  "project.manager_changed",
  "project.approved",
  "project.rejected",
  "project.deleted",
] as const satisfies readonly EventCode[];

const id = z.string().min(1);
const ref = z.object({ id, name: z.string() });
const change = <T extends z.ZodType>(value: T) => z.object({ from: value.nullable(), to: value });
const empty = z.object({});
const count = z.number().int().nonnegative();
const nullableCount = count.nullable();
const link = z.object({ id, url: z.string() });
const defects = z.array(z.object({ instance: ref, rule: z.string() }));
const projectChanges = z.array(z.object({ field: z.string(), from: z.unknown(), to: z.unknown() }));

// Typed payloads for the record History codes (EVENT-shape).
export const historyDataSchemas = {
  "request.created": z.object({ batch: ref.nullable(), source: ref.nullable() }),
  "request.approved": z.object({
    iterationId: id,
    isRescan: z.boolean(),
    batchSize: nullableCount,
    suggestion: z.object({ category: ref, classifier: ref, kept: z.boolean() }).nullable(),
  }),
  "request.declined": z.object({ batchSize: nullableCount }),
  "request.held": z.object({ why: z.literal("checking") }),
  "request.withdrawn": empty,
  "request.ingest_retried": z.object({ attempt: count }),
  "iteration.ingested": empty,
  "iteration.ingest_failed": z.object({ attempt: count, error: z.string().nullable() }),
  "iteration.rechecked": z.object({
    by: z.enum(["act", "catalog_change"]),
    found: count,
    gone: count,
    changed: z.array(z.object({ key: z.string(), previous: z.unknown(), value: z.unknown() })),
  }),
  "iteration.page_count_entered": z.object({ pages: count, previous: count.nullable() }),
  "iteration.verdict_accepted": z.object({ defects }),
  "iteration.verdict_denied": z.object({ defects }),
  "iteration.verdict_revoked": z.object({ defects }),
  "iteration.restricted": z.object({ rule: ref, outcome: z.enum(["forbidden", "restricted"]) }),
  "iteration.restriction_overruled": z.object({ rule: ref }),
  "iteration.reclassified": z.object({
    category: change(ref).nullable(),
    priority: change(z.lazy(() => prioritySchema)).nullable(),
  }),
  "iteration.cancelled": z.object({ list: ref.nullable() }),
  "iteration.not_digitizable": z.object({ list: ref }),
  "iteration.resumed": empty,
  "iteration.listed": z.object({ list: ref }),
  "iteration.unlisted": z.object({
    list: ref,
    why: z.enum(["edited", "cancelled", "list_deleted"]),
  }),
  "iteration.digitized": z.object({ list: ref.nullable() }),
  "iteration.published": z.object({ link }),
  "iteration.link_added": z.object({ link }),
  "iteration.link_changed": z.object({ link, url: change(z.string()) }),
  "iteration.link_made_primary": z.object({ link }),
  "iteration.link_removed": z.object({ link, primary: link.nullable() }),
  "iteration.copy_found": z.object({
    registry: z.string(),
    state: z.lazy(() => registryStateSchema),
  }),
  "iteration.property_changed": z.object({ key: z.string(), value: change(z.unknown()) }),
  "document.relinked": z.object({ catalogId: change(z.string()) }),
  "document.property_changed": z.object({ key: z.string(), value: change(z.unknown()) }),
  "document.registry_changed": z.object({
    registry: z.string(),
    state: change(z.lazy(() => registryStateSchema)),
  }),
  "list.created": z.object({
    generator: z.object({ name: z.string(), version: z.string() }).nullable(),
    members: count,
  }),
  "list.renamed": z.object({ name: change(z.string()) }),
  "list.dates_moved": z.object({ starts: change(z.iso.date()), ends: change(z.iso.date()) }),
  "list.members_changed": z.object({ added: z.array(id), removed: z.array(id) }),
  "list.started_early": z.object({ starts: z.iso.date() }),
  "list.marked_done": z.object({ digitized: count }),
  "list.deleted": z.object({ returned: count }),
  "project.created": empty,
  "project.details_changed": z.object({ changes: projectChanges }),
  "project.dates_changed": z.object({ changes: projectChanges }),
  "project.member_added": z.object({ userId: id }),
  "project.member_removed": z.object({ userId: id }),
  "project.manager_changed": z.object({ userId: change(id) }),
  "project.approved": z.object({ priority: z.lazy(() => prioritySchema), approved: count }),
  "project.rejected": z.object({ declined: count }),
  "project.deleted": empty,
} satisfies Record<(typeof historyCodes)[number], z.ZodType>;

const baseEntry = z.object({
  id,
  subjectKind: z.enum(["document", "iteration", "request", "list", "project"]),
  subjectId: id,
  at: z.iso.datetime(),
  actor: z.lazy(() => actorSchema),
  correlationId: z.string(),
  reason: z.object({ public: z.string().nullable(), internal: z.string().nullable() }),
});

function variant<C extends keyof typeof historyDataSchemas>(
  code: C,
  data: NoInfer<(typeof historyDataSchemas)[C]>,
) {
  return baseEntry.extend({ code: z.literal(code), data: data.nullable() });
}

// Keep every variant explicit so the inferred union preserves each code and payload pairing.
const eventEntryVariants = [
  variant("request.created", historyDataSchemas["request.created"]),
  variant("request.approved", historyDataSchemas["request.approved"]),
  variant("request.declined", historyDataSchemas["request.declined"]),
  variant("request.held", historyDataSchemas["request.held"]),
  variant("request.withdrawn", historyDataSchemas["request.withdrawn"]),
  variant("request.ingest_retried", historyDataSchemas["request.ingest_retried"]),
  variant("iteration.ingested", historyDataSchemas["iteration.ingested"]),
  variant("iteration.ingest_failed", historyDataSchemas["iteration.ingest_failed"]),
  variant("iteration.rechecked", historyDataSchemas["iteration.rechecked"]),
  variant("iteration.page_count_entered", historyDataSchemas["iteration.page_count_entered"]),
  variant("iteration.verdict_accepted", historyDataSchemas["iteration.verdict_accepted"]),
  variant("iteration.verdict_denied", historyDataSchemas["iteration.verdict_denied"]),
  variant("iteration.verdict_revoked", historyDataSchemas["iteration.verdict_revoked"]),
  variant("iteration.restricted", historyDataSchemas["iteration.restricted"]),
  variant("iteration.restriction_overruled", historyDataSchemas["iteration.restriction_overruled"]),
  variant("iteration.reclassified", historyDataSchemas["iteration.reclassified"]),
  variant("iteration.cancelled", historyDataSchemas["iteration.cancelled"]),
  variant("iteration.not_digitizable", historyDataSchemas["iteration.not_digitizable"]),
  variant("iteration.resumed", historyDataSchemas["iteration.resumed"]),
  variant("iteration.listed", historyDataSchemas["iteration.listed"]),
  variant("iteration.unlisted", historyDataSchemas["iteration.unlisted"]),
  variant("iteration.digitized", historyDataSchemas["iteration.digitized"]),
  variant("iteration.published", historyDataSchemas["iteration.published"]),
  variant("iteration.link_added", historyDataSchemas["iteration.link_added"]),
  variant("iteration.link_changed", historyDataSchemas["iteration.link_changed"]),
  variant("iteration.link_made_primary", historyDataSchemas["iteration.link_made_primary"]),
  variant("iteration.link_removed", historyDataSchemas["iteration.link_removed"]),
  variant("iteration.copy_found", historyDataSchemas["iteration.copy_found"]),
  variant("iteration.property_changed", historyDataSchemas["iteration.property_changed"]),
  variant("document.relinked", historyDataSchemas["document.relinked"]),
  variant("document.property_changed", historyDataSchemas["document.property_changed"]),
  variant("document.registry_changed", historyDataSchemas["document.registry_changed"]),
  variant("list.created", historyDataSchemas["list.created"]),
  variant("list.renamed", historyDataSchemas["list.renamed"]),
  variant("list.dates_moved", historyDataSchemas["list.dates_moved"]),
  variant("list.members_changed", historyDataSchemas["list.members_changed"]),
  variant("list.started_early", historyDataSchemas["list.started_early"]),
  variant("list.marked_done", historyDataSchemas["list.marked_done"]),
  variant("list.deleted", historyDataSchemas["list.deleted"]),
  variant("project.created", historyDataSchemas["project.created"]),
  variant("project.details_changed", historyDataSchemas["project.details_changed"]),
  variant("project.dates_changed", historyDataSchemas["project.dates_changed"]),
  variant("project.member_added", historyDataSchemas["project.member_added"]),
  variant("project.member_removed", historyDataSchemas["project.member_removed"]),
  variant("project.manager_changed", historyDataSchemas["project.manager_changed"]),
  variant("project.approved", historyDataSchemas["project.approved"]),
  variant("project.rejected", historyDataSchemas["project.rejected"]),
  variant("project.deleted", historyDataSchemas["project.deleted"]),
] as const;

// Audit-only configuration changes share one field-level payload shape.
export const configurationDataSchema = z.object({
  changes: z.array(z.object({ field: z.string(), from: z.unknown(), to: z.unknown() })),
});

// A History entry binds its code to that code's payload and subject.
export type HistoryCode = (typeof historyCodes)[number];
type EventEntryData = {
  [Code in HistoryCode]: { code: Code; data: z.infer<(typeof historyDataSchemas)[Code]> | null };
}[HistoryCode];
type EventEntryBase = z.infer<typeof baseEntry>;

// The explicit payload map retains the code/data pairing across zod's refinement type.
export type EventEntry = EventEntryBase & EventEntryData;
export type EventEntryInput = EventEntry extends infer Entry
  ? Entry extends { id: string }
    ? Omit<Entry, "id">
    : never
  : never;

// Validate each entry as the discriminated union before checking its catalogue subject.
export const eventEntrySchema = z
  .discriminatedUnion("code", eventEntryVariants)
  .superRefine((entry, context) => {
    if (entry.subjectKind !== eventCatalogue[entry.code].subject) {
      context.addIssue({ code: "custom", message: "Subject kind must match event code" });
    }
  }) as unknown as z.ZodType<EventEntry>;

// Public entries are limited to catalogue codes with public wording and forbidden restrictions.
export function isPublicEntry(entry: EventEntry): boolean {
  return (
    eventCatalogue[entry.code].isPublic &&
    (entry.code !== "iteration.restricted" || entry.data?.outcome === "forbidden")
  );
}

// Withhold the payload and internal reason, and hide staff actors from public readers.
export function publicEntryOf(entry: EventEntry): EventEntry {
  return {
    ...entry,
    data: null,
    reason: { ...entry.reason, internal: null },
    actor: (entry.actor.kind === "system" ? entry.actor : { kind: "undisclosed" }) as Actor,
  } as EventEntry;
}

// The ingest error requires a separate grant (LOG-ingest-detail).
export function withoutIngestError(entry: EventEntry): EventEntry {
  if (entry.code !== "iteration.ingest_failed" || entry.data === null) return entry;
  return { ...entry, data: { ...entry.data, error: null } };
}

// A cause produces one History row per code and correlation ID.
export function oncePerCause<T extends { correlationId: string; code: EventCode }>(
  entries: readonly T[],
): T[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.correlationId}|${entry.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
