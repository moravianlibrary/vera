// PLG-api-kinds: Registry; PLG-api-outcome.
import { z } from "zod";
import { documentSchema } from "../entities";
export const registryRefusals = z.never();
export const lookupInputSchema = z.object({
  record: documentSchema,
  identifiers: z.array(z.string()),
});
export const lookupAnswerSchema = z.object({
  records: z.array(z.object({ rawState: z.string(), link: z.string().url().nullable() })),
});
export interface Registry {
  lookup(input: LookupInput): Promise<LookupAnswer>;
}
export type LookupInput = z.infer<typeof lookupInputSchema>;
export type LookupAnswer = z.infer<typeof lookupAnswerSchema>;
