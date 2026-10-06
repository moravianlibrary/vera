// Every intention the caller sees, with what the server counted for each, and what an act on
// one refetches.

import { useQuery } from "@tanstack/react-query";
import { listIntentionIndex } from "@/api/intentions";
import { projectsQueryKey } from "@/features/projects/use-projects-query";

export const intentionsQueryKey = ["intentions"] as const;

// What an act on an intention changes: the page, and the project pages that list them.
export const intentionInvalidations = [intentionsQueryKey, projectsQueryKey];

export function useIntentionIndexQuery() {
  return useQuery({ queryKey: [...intentionsQueryKey, "index"], queryFn: listIntentionIndex });
}
