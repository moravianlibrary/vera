// PLG-api-kinds, PLG-api-cursor: Harvester; PLG-api-outcome.
import { z } from "zod";
export const harvesterRefusals = z.never();
export const harvestInputSchema = z.object({ cursor: z.string().nullable() });
export const harvestAnswerSchema = z.object({
  items: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
});
export interface Harvester {
  harvest(input: HarvestInput): Promise<HarvestAnswer>;
}
export type HarvestInput = z.infer<typeof harvestInputSchema>;
export type HarvestAnswer = z.infer<typeof harvestAnswerSchema>;
