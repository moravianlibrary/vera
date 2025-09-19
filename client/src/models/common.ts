import { z } from "zod";

// -------------------------
// Types
// -------------------------
export const AssignmentSchema = z.object({
    groups: z.array(z.number().int().min(1)),
    users: z.array(z.string().min(1)),
});
export type Assignment = z.infer<typeof AssignmentSchema>;

export const AssignmentChangeSchema = z.object({
    add: AssignmentSchema.optional(),
    remove: AssignmentSchema.optional(),
});
export type AssignmentChange = z.infer<typeof AssignmentChangeSchema>;

export const IdSchema = z.number().int().min(1);
export type Id = z.infer<typeof IdSchema>;

export const BatchParamsSchema = z.object({
    batch_id: IdSchema.optional(),
    batch_name: z.string().min(1).optional(),
    file_name: z.string().min(1).optional(),
});
export type BatchParams = z.infer<typeof BatchParamsSchema>;

export const NameSchema = z.string().min(1).max(255);
export type Name = z.infer<typeof NameSchema>;

export const CronExpressionSchema = z.string().min(1).max(255);
export type CronExpression = z.infer<typeof CronExpressionSchema>;

export const PrioritySchema = z
    .int()
    .min(1, { message: "Priority must be at least 1" })
    .max(5, { message: "Priority cannot exceed 5" });
export type Priority = z.infer<typeof PrioritySchema>;

export const UUIDSchema = z.uuid();
export type UUID = z.infer<typeof UUIDSchema>;

// -------------------------
// Enums
// -------------------------
export const ExportFormatSchema = z.enum(["xlsx", "csv", "txt", "pdf"]);
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
