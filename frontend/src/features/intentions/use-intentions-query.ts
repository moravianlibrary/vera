// Every intention the caller sees, with what the server counted for each, and what an act on
// one refetches.

import { useQuery } from "@tanstack/react-query";
import { listIntentionIndex } from "@/api/intentions";
import { categoriesQueryKey } from "@/features/categories/use-categories-query";
import { projectsQueryKey } from "@/features/projects/use-projects-query";

export const intentionsQueryKey = ["intentions"] as const;

// What an act on an intention changes: the page, the project pages that list them, and the mix
// Categories reads.
export const intentionInvalidations = [intentionsQueryKey, projectsQueryKey, categoriesQueryKey];

export function useIntentionIndexQuery() {
  return useQuery({ queryKey: [...intentionsQueryKey, "index"], queryFn: listIntentionIndex });
}
