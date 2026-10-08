// Every intention the caller sees, with what the server counted for each, one intention's mix,
// and what an act on one refetches.

import { skipToken, useQuery } from "@tanstack/react-query";
import { listIntentionIndex } from "@/api/intentions";
import { findIntentionMix } from "@/api/mixes";
import { categoriesQueryKey } from "@/features/categories/use-categories-query";
import { projectsQueryKey } from "@/features/projects/use-projects-query";

export const intentionsQueryKey = ["intentions"] as const;

// What an act on an intention changes: the page and its mixes, the project pages that show them,
// and the mix Categories reads.
export const intentionInvalidations = [intentionsQueryKey, projectsQueryKey, categoriesQueryKey];

export function useIntentionIndexQuery({ isEnabled = true }: { isEnabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...intentionsQueryKey, "index"],
    queryFn: listIntentionIndex,
    enabled: isEnabled,
  });
}

export function useIntentionMixQuery(intentionId: string | null) {
  return useQuery({
    queryKey: [...intentionsQueryKey, "mix", intentionId],
    queryFn: intentionId === null ? skipToken : () => findIntentionMix(intentionId),
  });
}
