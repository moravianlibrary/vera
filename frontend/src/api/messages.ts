// Calls the messages endpoints; what they take and answer is in @vera/contract/messages.

import type { MessageChannel, MessageHandOff, MessageSubject } from "@vera/contract/messages";
import {
  messageChannelSchema,
  messageHandOffSchema,
  messageSubjectParams,
} from "@vera/contract/messages";
import { apiRoutes } from "@vera/contract/routes";
import { z } from "zod";
import { getJson } from "@/api/http";

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
