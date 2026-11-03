// PLG-api-kinds: Link; PLG-api-outcome.
import { z } from "zod";
export const linkRefusals = ["not_this_registry", "malformed"] as const;
export const linkRefusalSchema = z.enum(linkRefusals);
export const canonicalInputSchema = z.object({ pasted: z.string() });
export const canonicalAnswerSchema = z.object({ url: z.string().url(), location: z.string() });
export interface Link {
  canonical(input: CanonicalInput): Promise<CanonicalAnswer>;
}
export type CanonicalInput = z.infer<typeof canonicalInputSchema>;
export type CanonicalAnswer = z.infer<typeof canonicalAnswerSchema>;
