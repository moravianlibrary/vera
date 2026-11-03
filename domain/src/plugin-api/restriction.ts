// PLG-api-kinds: Restriction; PLG-api-outcome.
import { z } from "zod";
import { documentSchema } from "../entities";
export const restrictionRefusals = z.never();
export const restrictionCheckInputSchema = z.object({
  record: documentSchema,
  properties: z.array(z.object({ key: z.string(), value: z.unknown() })),
});
export const restrictionCheckAnswerSchema = z.object({
  findings: z.array(
    z.object({
      rule: z.string(),
      forbidden: z.boolean(),
      until: z.iso.datetime().nullable(),
      why: z.string(),
    }),
  ),
});
export interface Restriction {
  check(input: RestrictionCheckInput): Promise<RestrictionCheckAnswer>;
}
export type RestrictionCheckInput = z.infer<typeof restrictionCheckInputSchema>;
export type RestrictionCheckAnswer = z.infer<typeof restrictionCheckAnswerSchema>;
