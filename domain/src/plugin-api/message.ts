// PLG-api-kinds: Message; PLG-api-outcome.
import { z } from "zod";
export const messageRefusals = z.never();
export const handOffInputSchema = z.object({
  recipients: z.array(z.string()),
  subject: z.string(),
  text: z.string(),
  sender: z.string().nullable().optional(),
});
export const handOffAnswerSchema = z.object({ address: z.string().nullable(), sent: z.boolean() });
export interface Message {
  handOff(input: HandOffInput): Promise<HandOffAnswer>;
}
export type HandOffInput = z.infer<typeof handOffInputSchema>;
export type HandOffAnswer = z.infer<typeof handOffAnswerSchema>;
