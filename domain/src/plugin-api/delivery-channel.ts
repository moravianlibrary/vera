// PLG-api-kinds: Delivery channel; PLG-api-outcome.
import { z } from "zod";
export const deliveryChannelRefusals = ["recipient_rejected"] as const;
export const deliveryChannelRefusalSchema = z.enum(deliveryChannelRefusals);
export const sendInputSchema = z.object({ recipient: z.string(), payload: z.unknown() });
export const sendAnswerSchema = z.object({ sent: z.literal(true) });
export const testInputSchema = z.object({ recipient: z.string() });
export const testAnswerSchema = z.object({
  sent: z.literal(true),
  elapsedMs: z.number().nonnegative(),
});
export interface DeliveryChannel {
  send(input: SendInput): Promise<SendAnswer>;
  test(input: TestInput): Promise<TestAnswer>;
}
export type SendInput = z.infer<typeof sendInputSchema>;
export type SendAnswer = z.infer<typeof sendAnswerSchema>;
export type TestInput = z.infer<typeof testInputSchema>;
export type TestAnswer = z.infer<typeof testAnswerSchema>;
