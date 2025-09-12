import { z } from "zod";

const IdSchema = z.number().int().min(1);
type Id = z.infer<typeof IdSchema>;

const IdentiferTypeSchema = z.enum([
    "Barcode",
    "SystemNumber",
    "Signature",
    "ISXN",
    "NBN",
]);
type IdentifierType = z.infer<typeof IdentiferTypeSchema>;

const PrioritySchema = z
    .int()
    .min(1, { message: "Priority must be at least 1" })
    .max(5, { message: "Priority cannot exceed 5" });
type Priority = z.infer<typeof PrioritySchema>;

const AssignmentSchema = z.object({
    groups: z.array(z.number().int().min(1)),
    users: z.array(z.string().min(1)),
});
type Assignment = z.infer<typeof AssignmentSchema>;

const AssignmentChangeSchema = z.object({
    add: AssignmentSchema.optional(),
    remove: AssignmentSchema.optional(),
});
type AssignmentChange = z.infer<typeof AssignmentChangeSchema>;

const BatchParamsSchema = z.object({
    batch_id: IdSchema.optional(),
    batch_name: z.string().min(1).optional(),
    file_name: z.string().min(1).optional(),
});
type BatchParams = z.infer<typeof BatchParamsSchema>;

export {
    IdSchema,
    IdentiferTypeSchema,
    PrioritySchema,
    AssignmentSchema,
    AssignmentChangeSchema,
    BatchParamsSchema,
};
export type {
    Id,
    IdentifierType,
    Priority,
    Assignment,
    AssignmentChange,
    BatchParams,
};
