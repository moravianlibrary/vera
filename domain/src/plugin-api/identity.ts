// PLG-api-kinds: Identity; PLG-api-outcome.
import { z } from "zod";
export const identityRefusals = ["wrong_credentials", "suspended", "not_allowed"] as const;
export const identityRefusalSchema = z.enum(identityRefusals);
export const beginInputSchema = z.object({ returnTo: z.string().optional() });
export const beginAnswerSchema = z.object({ redirect: z.string().url().nullable() });
export const completeInputSchema = z.union([
  z.object({ callback: z.record(z.string(), z.string()) }),
  z.object({ username: z.string(), password: z.string() }),
]);
export const completeAnswerSchema = z.object({
  externalId: z.string(),
  email: z.string().nullable(),
  name: z.string(),
  claims: z.record(z.string(), z.unknown()),
});
export interface Identity {
  begin(input: BeginInput): Promise<BeginAnswer>;
  complete(input: CompleteInput): Promise<CompleteAnswer>;
}
export type BeginInput = z.infer<typeof beginInputSchema>;
export type BeginAnswer = z.infer<typeof beginAnswerSchema>;
export type CompleteInput = z.infer<typeof completeInputSchema>;
export type CompleteAnswer = z.infer<typeof completeAnswerSchema>;
