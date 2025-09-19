import { z } from "zod";
import { NameSchema } from "../common";

// TODO: validate filters structure
export const EsFilterPresetSchema = z.object({
    id: z.uuid(),
    name: NameSchema,
    filters: z.record(z.string(), z.any()),
});
export type EsFilterPreset = z.infer<typeof EsFilterPresetSchema>;
