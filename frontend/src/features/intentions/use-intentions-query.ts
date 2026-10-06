// Every intention the caller sees, with what the server counted for each.

import { useQuery } from "@tanstack/react-query";
import { listIntentionIndex } from "@/api/intentions";

export const intentionsQueryKey = ["intentions"] as const;

export function useIntentionIndexQuery() {
  return useQuery({ queryKey: [...intentionsQueryKey, "index"], queryFn: listIntentionIndex });
}
