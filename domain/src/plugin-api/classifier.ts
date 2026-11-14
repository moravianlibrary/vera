// PLG-api-kinds: Classifier; PLG-api-outcome.
import { z } from "zod";
import { categorySchema, documentSchema, requestSchema } from "../entities";
export const classifierRefusals = z.never();
export const suggestInputSchema = z.object({
  request: requestSchema.and(z.object({ projectName: z.string().nullable() })),
  document: documentSchema,
});
export const suggestAnswerSchema = z
  .object({ category: categorySchema, why: z.string() })
  .nullable();
export interface Classifier {
  suggest(input: SuggestInput): Promise<SuggestAnswer>;
}
export type SuggestInput = z.infer<typeof suggestInputSchema>;
export type SuggestAnswer = z.infer<typeof suggestAnswerSchema>;
