// The Message instances and a message's hand-off (messaging.md). The instances change rarely, so
// they are fetched once per visit: whether there are any decides whether *Message…* exists at all.
// A hand-off is resolved afresh each time the dialog opens, since who asked may have changed.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { MessageSubject } from "@vera/contract/messages";
import { listMessageChannels, prepareMessage } from "@/api/messages";

export const messagesQueryKey = ["messages"] as const;

export function useMessageChannelsQuery() {
  return useQuery({
    queryKey: [...messagesQueryKey, "channels"],
    queryFn: listMessageChannels,
    staleTime: Infinity,
  });
}

// Null while the dialog is closed.
export function useMessageHandOffQuery(subject: MessageSubject | null) {
  return useQuery({
    queryKey: [...messagesQueryKey, "hand-off", subject?.kind, subject?.id],
    queryFn: subject === null ? skipToken : () => prepareMessage(subject),
    staleTime: 0,
  });
}
