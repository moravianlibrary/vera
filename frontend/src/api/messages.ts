// Messaging (messaging.md): VERA does not carry the conversation. It resolves who a message about
// a record goes to and hands off to a Message plugin instance, which opens a mail or a chat,
// pre-filled, in the person's own tool. VERA keeps none of the text and needs no permission of
// its own: a message about a record can be started by anyone who can see the record, and there
// is no *Message…* at all with no Message instance enabled (§4).
// TODO(rrandiak): instances whose result is *sent* (§2), for which the dialog asks for the text
// and VERA logs that a message was started; none is configured yet.

import { z } from "zod";
import { getJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";

// What a message can be about; each kind resolves its own recipients (messaging.md §3).
// A restriction's message goes to those who may overrule it (Validations' *Message admins…*).
export const messageSubjectKinds = ["proposal", "restriction"] as const;
export const messageSubjectKindSchema = z.enum(messageSubjectKinds);
export type MessageSubjectKind = z.infer<typeof messageSubjectKindSchema>;

export interface MessageSubject {
  readonly kind: MessageSubjectKind;
  // The record's own ID: a document's for a proposal, an iteration's for a restriction.
  readonly id: string;
}

export const messageSubjectParams = { kind: "subject", id: "id" } as const;

// An enabled Message plugin instance, offered in its configured order, the first preselected.
export const messageChannelSchema = z.object({
  id: z.string(),
  // "Email", "MZK Slack".
  name: z.string(),
  // What opening it does: "opens your mail, pre-filled".
  description: z.string(),
});
export type MessageChannel = z.infer<typeof messageChannelSchema>;

export const messageRecipientSchema = z.object({ userId: z.string(), name: z.string() });
export type MessageRecipient = z.infer<typeof messageRecipientSchema>;

// What one instance makes of the recipients: who it can reach, and where it hands off to; null
// when it reaches nobody.
export const channelHandOffSchema = z.object({
  channelId: z.string(),
  reachableIds: z.array(z.string()),
  href: z.string().url().nullable(),
});
export type ChannelHandOff = z.infer<typeof channelHandOffSchema>;

export const messageHandOffSchema = z.object({
  // The record, "Herbář moravský · D20", and its address in VERA, carried in the message.
  about: z.object({ label: z.string(), path: z.string() }),
  // Why: "Proposed for digitization · 4 asks".
  context: z.string(),
  // Resolved from the record, never typed; the sender is left out.
  recipients: z.array(messageRecipientSchema),
  // One per channel, in the channels' order.
  handOffs: z.array(channelHandOffSchema),
});
export type MessageHandOff = z.infer<typeof messageHandOffSchema>;

export async function listMessageChannels(): Promise<MessageChannel[]> {
  return getJson(apiRoutes.messageChannels, z.array(messageChannelSchema));
}

export async function prepareMessage(subject: MessageSubject): Promise<MessageHandOff> {
  const params = new URLSearchParams({
    [messageSubjectParams.kind]: subject.kind,
    [messageSubjectParams.id]: subject.id,
  });
  return getJson(apiRoutes.messageHandOff, messageHandOffSchema, params);
}
