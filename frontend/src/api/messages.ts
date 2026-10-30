// Calls the messages endpoints; what they take and answer is in @vera/contract/messages.

import type { MessageChannel, MessageHandOff, MessageSubject } from "@vera/contract/messages";
import {
  messageChannelSchema,
  messageHandOffSchema,
  messageSubjectParams,
  sendMessageResponseSchema,
} from "@vera/contract/messages";
import { apiRoutes } from "@vera/contract/routes";
import { z } from "zod";
import { getJson, postJson } from "@/api/http";

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

export async function sendMessage(
  subject: MessageSubject,
  body: { channelId: string; text: string },
): Promise<{ reachedIds: string[] }> {
  const params = new URLSearchParams({
    [messageSubjectParams.kind]: subject.kind,
    [messageSubjectParams.id]: subject.id,
  });
  return postJson(`${apiRoutes.messageSend}?${params}`, body, sendMessageResponseSchema);
}
