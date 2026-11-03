// PLG-api-kinds: Property source; PLG-api-outcome.
import { z } from "zod";
import { documentSchema, iterationSchema } from "../entities";
export const propertySourceRefusals = z.never();
export const valuesInputSchema = z.object({ record: documentSchema, iteration: iterationSchema });
export const valuesAnswerSchema = z.object({
  values: z.array(z.object({ key: z.string(), value: z.unknown(), tier: z.number().int() })),
});
export interface PropertySource {
  values(input: ValuesInput): Promise<ValuesAnswer>;
}
export type ValuesInput = z.infer<typeof valuesInputSchema>;
export type ValuesAnswer = z.infer<typeof valuesAnswerSchema>;
