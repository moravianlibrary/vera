// The Categories page's tree, custody and one intention's mix. Switching the intention keeps the
// tree on screen until the new mix arrives.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCategoryIndex } from "@/api/categories";

export const categoriesQueryKey = ["categories"] as const;

export function useCategoryIndexQuery(intentionId: string | null) {
  return useQuery({
    queryKey: [...categoriesQueryKey, "index", intentionId],
    queryFn: () => getCategoryIndex(intentionId),
    placeholderData: keepPreviousData,
  });
}
