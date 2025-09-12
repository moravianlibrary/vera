import { z } from "zod";
import { IdentiferTypeSchema, IdSchema, PrioritySchema } from "./common";

const AdditionCreateSchema = z.object({
    identifier_type: IdentiferTypeSchema,
    identifier_value: z.string().min(1),
    category_id: IdSchema,
    priority: PrioritySchema,
});
type AdditionCreate = z.infer<typeof AdditionCreateSchema>;

const AdditionsSettingsParamsSchema = z.object({
    allow_new_iteration: z.boolean().default(false),
    ignore_digitization_check: z.boolean().default(false),
});
type AdditionsSettingsParams = z.infer<typeof AdditionsSettingsParamsSchema>;

export { AdditionCreateSchema, AdditionsSettingsParamsSchema };
export type { AdditionCreate, AdditionsSettingsParams };
