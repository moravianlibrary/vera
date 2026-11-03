// PLG-api-kinds, PLG-api-cursor, PLG-api-mirror: Catalog adapter; PLG-api-outcome.
import { z } from "zod";
import { documentTypeSchema } from "../entities";
export const catalogAdapterRefusals = ["not_found", "not_this_catalog", "malformed"] as const;
export const catalogAdapterRefusalSchema = z.enum(catalogAdapterRefusals);
export const readInputSchema = z.object({ catalogId: z.string() });
export const readAnswerSchema = z.object({
  catalogId: z.string(),
  fields: z.record(z.string(), z.unknown()),
  units: z.array(z.string()).nullable(),
  issuanceType: documentTypeSchema,
  readAt: z.iso.datetime(),
});
export const readLinkInputSchema = z.object({ pasted: z.string() });
export const readLinkAnswerSchema = z.object({ catalogId: z.string() });
export const searchInputSchema = z.object({ query: z.string() });
export const searchAnswerSchema = z.object({
  hits: z.array(
    z.object({ catalogId: z.string(), title: z.string(), units: z.array(z.string()).nullable() }),
  ),
});
export const changesInputSchema = z.object({ cursor: z.string().nullable() });
export const changesAnswerSchema = z.object({
  catalogIds: z.array(z.string()),
  nextCursor: z.string().nullable(),
});
export const syncInputSchema = z.object({ cursor: z.string().nullable() });
export const syncAnswerSchema = z.object({
  keep: z.array(
    z.object({
      catalogId: z.string(),
      title: z.string(),
      units: z.array(z.string()).nullable(),
      identifiers: z.array(z.string()),
      text: z.string(),
      record: z.record(z.string(), z.unknown()),
    }),
  ),
  drop: z.array(z.string()),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export interface CatalogAdapter {
  read(input: ReadInput): Promise<ReadAnswer>;
}
export interface LinkReader {
  readLink(input: ReadLinkInput): Promise<ReadLinkAnswer>;
}
export interface SearchableCatalog {
  search(input: SearchInput): Promise<SearchAnswer>;
}
export interface ChangeFeed {
  changes(input: ChangesInput): Promise<ChangesAnswer>;
}
export interface MirroredCatalog {
  sync(input: SyncInput): Promise<SyncAnswer>;
}
export type ReadInput = z.infer<typeof readInputSchema>;
export type ReadAnswer = z.infer<typeof readAnswerSchema>;
export type ReadLinkInput = z.infer<typeof readLinkInputSchema>;
export type ReadLinkAnswer = z.infer<typeof readLinkAnswerSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;
export type SearchAnswer = z.infer<typeof searchAnswerSchema>;
export type ChangesInput = z.infer<typeof changesInputSchema>;
export type ChangesAnswer = z.infer<typeof changesAnswerSchema>;
export type SyncInput = z.infer<typeof syncInputSchema>;
export type SyncAnswer = z.infer<typeof syncAnswerSchema>;
