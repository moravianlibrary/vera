// PLG-api-kinds: Identifier; PLG-api-outcome.
import { z } from "zod";
export const identifierRefusals = ["checksum"] as const;
export const identifierRefusalSchema = z.enum(identifierRefusals);
export const recogniseInputSchema = z.object({ value: z.string() });
export const recogniseAnswerSchema = z.object({
  recognised: z.boolean(),
  normalForm: z.string().nullable(),
});
export interface Identifier {
  recognise(input: RecogniseInput): Promise<RecogniseAnswer>;
}
export type RecogniseInput = z.infer<typeof recogniseInputSchema>;
export type RecogniseAnswer = z.infer<typeof recogniseAnswerSchema>;
