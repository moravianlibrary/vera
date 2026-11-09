// PLG-api-kinds: List generator; PLG-api-outcome.
import { z } from "zod";
import { iterationSchema } from "../entities";
export const listGeneratorRefusals = z.never();
export const shortfallCauses = ["leftOut", "overshoot", "noSupply", "unallocated"] as const;
export const shortfallCauseSchema = z.enum(shortfallCauses);
export const generateInputSchema = z.object({
  // The shaping intention, by name; VERA has already narrowed the pool to its scope.
  intention: z.object({ id: z.string(), name: z.string() }),
  hasMix: z.boolean(),
  leaves: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      parentId: z.string().nullable(),
      topCategoryId: z.string(),
      share: z.number().nullable(),
      nodeId: z.string().nullable(),
    }),
  ),
  nodes: z.array(z.object({ id: z.string(), share: z.number().nullable() })),
  pool: z.array(
    z.object({
      iteration: iterationSchema,
      pages: z.number().int().nonnegative(),
      askedAt: z.string(),
    }),
  ),
  members: z.array(z.object({ iteration: iterationSchema, pages: z.number().int().nonnegative() })),
  pages: z.number().int().nonnegative(),
  topCategoryIds: z.array(z.string()),
  allocation: z.record(z.string(), z.number()).nullable(),
});
export const generateAnswerSchema = z.object({
  picks: z.array(z.object({ iterationId: z.string(), why: z.string() })),
  spreadCount: z.number().int().nonnegative(),
  shortfalls: z.array(
    z.object({
      categoryId: z.string(),
      pages: z.number().int().nonnegative(),
      cause: shortfallCauseSchema,
    }),
  ),
});
export interface ListGenerator {
  generate(input: GenerateInput): Promise<GenerateAnswer>;
}
export type GenerateInput = z.infer<typeof generateInputSchema>;
export type GenerateAnswer = z.infer<typeof generateAnswerSchema>;
export type ShortfallCause = z.infer<typeof shortfallCauseSchema>;
