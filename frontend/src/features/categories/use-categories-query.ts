// The Categories page's tree, custody and Overall's mix, and what a change to the tree reaches.

import { skipToken, useQuery } from "@tanstack/react-query";
import { getCategoryImpact, getCategoryIndex } from "@/api/categories";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { referenceQueryKey } from "@/hooks/use-reference-query";
import { sessionQueryKey } from "@/hooks/use-session-query";

export const categoriesQueryKey = ["categories"] as const;

// The Intentions page's, named here rather than imported: it imports this module's key.
const intentionsQueryKey = ["intentions"] as const;

// A change to the tree shows in the tree everyone reads names from, in the mixes over it, in the
// documents a refine moved, and in the caller's own custody.
export const categoryInvalidations = [
  categoriesQueryKey,
  [...referenceQueryKey, "categories"],
  intentionsQueryKey,
  documentsQueryKey,
  sessionQueryKey,
];

export function useCategoryIndexQuery() {
  return useQuery({
    queryKey: [...categoriesQueryKey, "index"],
    queryFn: getCategoryIndex,
  });
}

// What deleting or refining the category would touch, while its dialog or wizard is open.
export function useCategoryImpactQuery(categoryId: string, isEnabled: boolean) {
  return useQuery({
    queryKey: [...categoriesQueryKey, "impact", categoryId],
    queryFn: isEnabled ? () => getCategoryImpact(categoryId) : skipToken,
  });
}
