import { z } from "zod";

// -------------------------
// Enums
// -------------------------
export const DigitizationRecordStateSchema = z.enum([
    "Finished",
    "InProgress",
    "Planned",
    "Revision",
    "Unknown",
]);
export type DigitizationRecordState = z.infer<
    typeof DigitizationRecordStateSchema
>;

export const DigitizationStateSchema = z.enum([
    "Finished",
    "InProgress",
    "Planned",
    "Revision",
    "Unknown",
    "Ambiguous",
    "NotAvailable",
    "NotDigitized",
]);
export type DigitizationState = z.infer<typeof DigitizationStateSchema>;

export const DigitizationListStateSchema = z.enum([
    "Revision",
    "Planned",
    "InProgress",
    "Finished",
]);
export type DigitizationListState = z.infer<typeof DigitizationListStateSchema>;
