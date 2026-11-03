// PLG-api-kinds: List generator; PLG-api-outcome.
import { z } from "zod";
import { intentionSchema, iterationSchema, mixRevisionSchema } from "../entities";
export const listGeneratorRefusals = z.never();
export const generateInputSchema = z.object({
  intention: intentionSchema,
  mix: mixRevisionSchema,
  pool: z.array(iterationSchema),
  pageBudget: z.number().int().nonnegative(),
});
export const generateAnswerSchema = z.object({
  picked: z.array(z.object({ iteration: iterationSchema, why: z.string() })),
  shortBy: z.number().int().nonnegative(),
});
export interface ListGenerator {
  generate(input: GenerateInput): Promise<GenerateAnswer>;
}
export type GenerateInput = z.infer<typeof generateInputSchema>;
export type GenerateAnswer = z.infer<typeof generateAnswerSchema>;
