import { z } from "zod";

const GroupSummarySchema = z.object({
    id: z.number(),
    name: z.string(),
});
type GroupSummary = z.infer<typeof GroupSummarySchema>;

export { GroupSummarySchema };
export type { GroupSummary };
