// PLG-api-kinds, PLG-api-entry: Input; PLG-api-outcome.
import { z } from "zod";
export const inputRefusals = ["unreadable", "origin_not_allowed"] as const;
export const inputRefusalSchema = z.enum(inputRefusals);
export const readBarcodeInputSchema = z.object({ photo: z.string() });
export const readBarcodeAnswerSchema = z.object({ value: z.string().nullable() });
export const readPhotoInputSchema = z.object({ photo: z.string() });
export const readPhotoAnswerSchema = z.object({
  seen: z.string(),
  values: z.array(
    z.object({ label: z.string(), value: z.string(), confidence: z.number().min(0).max(1) }),
  ),
  candidates: z.array(z.object({ catalogId: z.string(), title: z.string(), why: z.string() })),
});
export const entryInputSchema = z.object({
  parameters: z.record(z.string(), z.string()),
  page: z.string().url(),
});
export const entryAnswerSchema = z.object({
  item: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("catalogId"), catalogId: z.string() }),
      z.object({ kind: z.literal("identifier"), type: z.string(), value: z.string() }),
      z.object({ kind: z.literal("unit"), value: z.string() }),
      z.object({ kind: z.literal("reason"), value: z.string() }),
    ])
    .nullable(),
  origin: z.string().url(),
});
declare const inputPluginKind: unique symbol;
export interface Input {
  readonly [inputPluginKind]?: never;
}
export interface BarcodeReader {
  readBarcode(input: ReadBarcodeInput): Promise<ReadBarcodeAnswer>;
}
export interface PhotoReader {
  readPhoto(input: ReadPhotoInput): Promise<ReadPhotoAnswer>;
}
export interface EntryLinkInput {
  entry(input: EntryInput): Promise<EntryAnswer>;
}
export type ReadBarcodeInput = z.infer<typeof readBarcodeInputSchema>;
export type ReadBarcodeAnswer = z.infer<typeof readBarcodeAnswerSchema>;
export type ReadPhotoInput = z.infer<typeof readPhotoInputSchema>;
export type ReadPhotoAnswer = z.infer<typeof readPhotoAnswerSchema>;
export type EntryInput = z.infer<typeof entryInputSchema>;
export type EntryAnswer = z.infer<typeof entryAnswerSchema>;
