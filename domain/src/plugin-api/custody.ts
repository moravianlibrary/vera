// PLG-api-kinds: Custody; PLG-api-outcome.
import { z } from "zod";
import { documentSchema, requestSchema } from "../entities";
export const custodyRefusals = z.never();
export const placeInputSchema = z.object({ request: requestSchema, document: documentSchema });
export const placeAnswerSchema = z.object({ custodies: z.array(z.string()) });
export interface Custody {
  place(input: PlaceInput): Promise<PlaceAnswer>;
}
export type PlaceInput = z.infer<typeof placeInputSchema>;
export type PlaceAnswer = z.infer<typeof placeAnswerSchema>;
