// Proposing: the deployment's limits, the check each item runs as it lands, and the submit that
// turns the items into requests (view-map.md §1, propose). The check asks the catalog for the
// identifier, then VERA for the document, so each item says what submitting will do. One item
// is a request; several are one batch.

import { batchSchema, prioritySchema } from "@vera/domain/entities";
import { identifierTypeRuleSchema, identifierTypeSchema } from "@vera/domain/identifiers";
import { z } from "zod";
import { recordStatusSchema } from "./documents";

const namedSchema = z.object({ id: z.string(), name: z.string() });

// What the server returns about rate limits for the current user.
export const rateLimitStatusSchema = z.object({
  perDay: z.number().int().nonnegative().nullable(),
});

export type RateLimitStatus = z.infer<typeof rateLimitStatusSchema>;

const unit = z.string().min(1).nullable();

export const proposalItemSchema = z.object({
  type: identifierTypeSchema,
  value: z.string().min(1),
  unit,
});

export type ProposalItem = z.infer<typeof proposalItemSchema>;

const found = {
  catalogId: z.string(),
  unit,
  title: z.string(),
};

// What submitting an item will do, by the catalog's and VERA's answers.
export const proposalCheckSchema = z.discriminatedUnion("kind", [
  // Proposes it. Asked before when VERA holds the document but nothing is moving.
  z.object({ kind: z.literal("new"), ...found, isAskedBefore: z.boolean() }),
  // Asks for it too: joins the work under way, or the decision every asker waits on.
  z.object({
    kind: z.literal("inVera"),
    ...found,
    documentId: z.string(),
    status: recordStatusSchema,
  }),
  // The caller already asks for it; skipped.
  z.object({ kind: z.literal("mine"), ...found, documentId: z.string() }),
  // A record of several volumes or issues, and none given: nothing until one is picked.
  z.object({
    kind: z.literal("whichUnit"),
    catalogId: z.string(),
    title: z.string(),
    units: z.array(z.string()).min(1),
  }),
  // An identifier the catalog gives for several records: nothing until one or more are picked,
  // each its own item (DOC-records).
  z.object({
    kind: z.literal("whichRecord"),
    records: z.array(z.object({ catalogId: z.string(), title: z.string() })).min(2),
  }),
  // Skipped and reported, never guessed.
  z.object({ kind: z.literal("notInCatalog") }),
]);

export type ProposalCheck = z.infer<typeof proposalCheckSchema>;

export const proposalLookupSchema = z.object({ items: z.array(proposalItemSchema).min(1) });

export const proposalDraftSchema = z.object({
  items: z.array(proposalItemSchema.extend({ reason: z.string().nullable() })).min(1),
  // For every item without its own.
  reason: z.string().nullable(),
  projectId: z.string().nullable(),
  // Null leaves the name to the server: when the batch was submitted (ENT-batch).
  batchName: z.string().nullable(),
  // Approve the new items with no copy at once; `request.decide` (LC-REQ-approve-now).
  approval: z.object({ categoryId: z.string(), priority: prioritySchema }).nullable(),
});

export type ProposalDraft = z.infer<typeof proposalDraftSchema>;

export const proposalReportSchema = z.object({
  batch: batchSchema.nullable(),
  proposed: z.number().int().nonnegative(),
  // Of the proposed, those approved at once; the rest stay Pending (LC-REQ-approve-now).
  approved: z.number().int().nonnegative(),
  joined: z.number().int().nonnegative(),
  skipped: z.array(proposalItemSchema),
});

export type ProposalReport = z.infer<typeof proposalReportSchema>;

// ---------------------------------------------------------------- ways in

// A record a catalog search found, ready to add as a catalog ID.
export const catalogHitSchema = z.object({
  catalogId: z.string(),
  title: z.string(),
  // The units it enumerates, for the person to see before adding.
  units: z.array(z.string()),
  catalog: namedSchema,
});

export type CatalogHit = z.infer<typeof catalogHitSchema>;

export const recordLinkSchema = z.object({
  catalogInstanceId: z.string(),
  link: z.string().trim().min(1),
});

export type RecordLink = z.infer<typeof recordLinkSchema>;

// The catalog ID the link or ID names; refused when the catalog reads neither.
export const recordLinkReadingSchema = z.object({ catalogId: z.string() });

// What a photo was read as, and the records it matched, each with why: nothing is added until
// one is picked.
export const photoReadingSchema = z.object({
  // "a catalog card", "a cover".
  seen: z.string(),
  read: z.array(
    z.object({ label: z.string(), value: z.string(), confidence: z.number().min(0).max(1) }),
  ),
  // Whether any identifier was on it; otherwise it was matched by its text.
  hasIdentifiers: z.boolean(),
  candidates: z.array(z.object({ catalogId: z.string(), title: z.string(), why: z.string() })),
});

export type PhotoReading = z.infer<typeof photoReadingSchema>;

// ACT-ways-in: the code the barcode-reading Input plugin read on one photo, or none.
export const barcodeReadingSchema = z.object({ code: z.string().nullable() });

export type BarcodeReading = z.infer<typeof barcodeReadingSchema>;

// The ways in beyond typing, pasting, a file and a hardware scanner, each there only while its
// plugin is enabled (ACT-ways-in, PERM-absent-not-disabled).
export const proposalSettingsSchema = z.object({
  // Effective role limit for the current user; null means unlimited.
  maxAtOnce: z.number().int().nonnegative().nullable(),
  // Whether an enabled Input instance reads each pasted line's type; without one the person
  // picks the type and every line is read as it.
  canDetectTypes: z.boolean(),
  // The enabled Catalog adapters that can be searched from here.
  searchCatalogs: z.array(namedSchema),
  // Every enabled Catalog adapter, searchable or not, whose record link or ID is read; where to
  // find a record there.
  linkCatalogs: z.array(namedSchema.extend({ opacUrl: z.url().nullable() })),
  // An enabled Input instance reads barcodes from the camera; a hardware scanner needs none.
  canScanWithCamera: z.boolean(),
  // An enabled Input instance reads photos and matches them to catalog records.
  canReadPhotos: z.boolean(),
  // DOC-identifiers: each type by its Identifier instance, in the order that decides detection.
  identifierTypes: z.array(identifierTypeRuleSchema),
});

export type ProposalSettings = z.infer<typeof proposalSettingsSchema>;
