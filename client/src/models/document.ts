import { z } from "zod";
import { CatalogRecordIdentifierSchema } from "./catalog_record";
import { ExportFormatSchema, IdSchema, PrioritySchema } from "./common";
import { WatchlistSummarySchema } from "./watchlist";
import {
    DigitizationListStateSchema,
    DigitizationRecordStateSchema,
    DigitizationStateSchema,
} from "./digitization";
import { createEsHitSchema, createEsResponseSchema } from "./api/responses/es";

// -------------------------
// Types
// -------------------------
export const PageCountSchema = z.number().int().min(1).max(10000);
export type PageCount = z.infer<typeof PageCountSchema>;

// -------------------------
// Enums
// -------------------------
export const DocumentStatusSchema = z.enum([
    "Archived",
    "AlreadyExtracted",
    "CanBeExtracted",
    "CannotBeExtracted",
    "MissingPageCount",
    "SubsequentIteration",
    "CatalogRecordSynced",
    "CatalogRecordUnreachable",
    "CatalogRecordDeleted",
    "CatalogRecordValid",
    "CatalogRecordInvalid",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DigitizationDecisionSchema = z.enum(["Decline", "RevokeDecline"]);
export type DigitizationDecision = z.infer<typeof DigitizationDecisionSchema>;

// -------------------------
// Query Parameters
// -------------------------
export const ExportDocumentsParamsSchema = z.object({
    filename: z.string().optional(),
    format: ExportFormatSchema.optional(),
});
export type ExportDocumentsParams = z.infer<typeof ExportDocumentsParamsSchema>;

// TODO: System setting for max page count and max document count
export const GenerateDocumentListParamsSchema = z.object({
    use_distribution: z.boolean().optional(),
    target_page_count: z.number().int().min(1),
    target_document_count: z.number().int().min(1).optional(),
});
export type GenerateDocumentListParams = z.infer<
    typeof GenerateDocumentListParamsSchema
>;

export const SyncDocumentsParamsSchema = z.object({
    catalog_record: z.boolean().optional(),
    digitization_state: z.boolean().optional(),
    properties: z.boolean().optional(),
});
export type SyncDocumentsParams = z.infer<typeof SyncDocumentsParamsSchema>;

// -------------------------
// Response Objects
// -------------------------
export const DocumentDigitizationRecordSchema = z.object({
    registry_record_id: z.string(),
    record_state: z.array(DigitizationRecordStateSchema),
    registry_issue_id: z.string().optional().nullable(),
    issue_state: z.array(DigitizationRecordStateSchema).optional().nullable(),
});
export type DocumentDigitizationRecord = z.infer<
    typeof DocumentDigitizationRecordSchema
>;

export const DocumentSchema = z.object({
    id: IdSchema,
    catalog_record_id: z.string(),
    document_id: IdSchema,
    iteration: z.number(),

    material_type: z.string(),
    title: z.string(),
    subtitle: z.string().optional().nullable(),
    identifiers: z.array(CatalogRecordIdentifierSchema),

    barcode: z.string().optional().nullable(),
    volume_number: z.string().optional().nullable(),
    volume_year: z.string().optional().nullable(),
    bundle: z.string().optional().nullable(),
    issuance_type: z.string().optional().nullable(),

    category_id: IdSchema,
    priority: PrioritySchema,

    digitization_state: z.array(DigitizationStateSchema),
    digitization_records: z.array(DocumentDigitizationRecordSchema),

    page_count_manual: z.number().optional().nullable(),
    page_count: z.number().optional().nullable(),

    properties: z.record(z.string(), z.any()),

    digitization_list_id: IdSchema.optional().nullable(),
    // TODO: ?
    digitization_list_state: DigitizationListStateSchema.optional().nullable(),

    current_status: z.array(DocumentStatusSchema),

    created_by: z.string(),
    created_at: z.string().transform((s) => new Date(s)),
    updated_at: z.string().transform((s) => new Date(s)),

    watchlists: z.array(WatchlistSummarySchema),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentHitSchema = createEsHitSchema(DocumentSchema);
export type DocumentHit = z.infer<typeof DocumentHitSchema>;

export const EsDocumentResponseSchema = createEsResponseSchema(
    DocumentSchema.partial()
);
export type EsDocumentResponse = z.infer<typeof EsDocumentResponseSchema>;
