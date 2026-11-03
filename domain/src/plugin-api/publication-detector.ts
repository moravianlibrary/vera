// PLG-api-kinds: Publication detector; PLG-api-outcome.
import { z } from "zod";
import { iterationSchema } from "../entities";
export const publicationDetectorRefusals = z.never();
export const detectInputSchema = z.object({ iterations: z.array(iterationSchema) });
export const detectAnswerSchema = z.object({
  links: z.array(z.object({ iterationId: z.string(), url: z.string().url() })),
});
export interface PublicationDetector {
  detect(input: DetectInput): Promise<DetectAnswer>;
}
export type DetectInput = z.infer<typeof detectInputSchema>;
export type DetectAnswer = z.infer<typeof detectAnswerSchema>;
