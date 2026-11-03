// PLG-api-kinds: Validation; PLG-api-outcome.
import { z } from "zod";
import { documentSchema, iterationSchema } from "../entities";
export const validationRefusals = z.never();
export const validationCheckInputSchema = z.object({
  record: documentSchema,
  properties: z.array(z.object({ key: z.string(), value: z.unknown() })),
});
export const validationCheckAnswerSchema = z.object({
  defects: z.array(z.object({ rule: z.string(), field: z.string(), detail: z.string() })),
});
export interface Validation {
  check(input: ValidationCheckInput): Promise<ValidationCheckAnswer>;
}
export type ValidationCheckInput = z.infer<typeof validationCheckInputSchema>;
export type ValidationCheckAnswer = z.infer<typeof validationCheckAnswerSchema>;
export const iterationValidationCheckInputSchema = z.object({
  record: documentSchema,
  iteration: iterationSchema,
});
