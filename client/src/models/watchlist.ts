import { z } from "zod";

const WatchlistSummarySchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().optional(),
    entered_at: z.string().transform((s) => new Date(s)),
    exited_at: z
        .string()
        .optional()
        .transform((s) => (s ? new Date(s) : undefined)),
    active: z.boolean(),
});
type WatchlistSummary = z.infer<typeof WatchlistSummarySchema>;

export { WatchlistSummarySchema };
export type { WatchlistSummary };
