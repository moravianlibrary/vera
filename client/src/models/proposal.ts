import { z } from "zod";
import { IdentiferTypeSchema } from "./common";

const ProposalCreateSchema = z.object({
    identifier_type: IdentiferTypeSchema,
    identifier_value: z.string().min(1),
    justification: z.string().optional().nullable(),
});
type ProposalCreate = z.infer<typeof ProposalCreateSchema>;

export { ProposalCreateSchema };
export type { ProposalCreate };
