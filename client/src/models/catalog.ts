import { z } from "zod";

// -------------------------
// Enums
// -------------------------
export const IdentiferTypeSchema = z.enum([
    "Barcode",
    "SystemNumber",
    "Signature",
    "ISXN",
    "NBN",
]);
export type IdentifierType = z.infer<typeof IdentiferTypeSchema>;

export const MaterialTypeSchema = z.enum([
    "Book",
    "ContinuingResource",
    "Graphic",
    "Map",
    "Music",
    "Other",
]);
export type MaterialType = z.infer<typeof MaterialTypeSchema>;

export const IssuanceTypeSchema = z.enum(["Unit", "Volume", "Bundle"]);
export type IssuanceType = z.infer<typeof IssuanceTypeSchema>;
