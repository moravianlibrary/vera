// Messaging (messaging.md): VERA does not carry the conversation. It resolves who a message about
// a record goes to and hands off to a Message plugin instance, which opens a mail or a chat,
// pre-filled, in the person's own tool. VERA keeps none of the text and needs no permission of
// its own: a message about a record can be started by anyone who can see the record, and there
// is no *Message…* at all with no Message instance enabled (MSG-keeps-nothing, MSG-order).
// MSG-handoff: redirect instances open the writer's tool; sending instances receive text and report
// their result.

import { z } from "zod";

// What a message is about and whom it reaches, each kind with its own act (MSG-recipients): a
// proposal's askers (*Message askers…*), those who may overrule a forbidden item (*Ask to
// overrule…*) and its askers (*Message askers…*), a project's manager (*Message manager…*), and
// whoever made the list an item is on (*Message list author…*).
export const messageSubjectKinds = [
  "proposal",
  "overrule",
  "forbiddenAskers",
  "project",
  "listedItem",
] as const;

export const messageSubjectKindSchema = z.enum(messageSubjectKinds);

export type MessageSubjectKind = z.infer<typeof messageSubjectKindSchema>;

export interface MessageSubject {
  readonly kind: MessageSubjectKind;
  // The record's own ID: a document's for a proposal, a project's for a project, else an
  // iteration's.
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
  // redirect: opens the writer's own tool; sent: the instance posts it itself (MSG-handoff).
  result: z.enum(["redirect", "sent"]),
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

// Refusals: message.not_sending, message.unreachable, message.refused.
export const sendMessageBodySchema = z.object({
  // Both optional so a missing one answers its own refusal code, not the contract's.
  channelId: z.string().optional(),
  text: z.string().max(4000).optional(),
});

export const sendMessageResponseSchema = z.object({ reachedIds: z.array(z.string()) });
