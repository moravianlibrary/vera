// The Categories page's tree, custody and Overall's mix.

import { useQuery } from "@tanstack/react-query";
import { getCategoryIndex } from "@/api/categories";

export const categoriesQueryKey = ["categories"] as const;

export function useCategoryIndexQuery() {
  return useQuery({
    queryKey: [...categoriesQueryKey, "index"],
    queryFn: getCategoryIndex,
  });
}
