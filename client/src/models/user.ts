import { z } from "zod";

const UserSummarySchema = z.object({
    id: z.number(),
    username: z.string(),
});
type UserSummary = z.infer<typeof UserSummarySchema>;

export { UserSummarySchema };
export type { UserSummary };
