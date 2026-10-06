// Iterations held in Documents Validations within the caller's custody: the list a slice at a time
// and one iteration with its history. A verdict, a fix or a cancellation changes what Documents,
// Validations and the watchlist counts show, so each refetches all three.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { ValidationQuery } from "@/api/validations";
import { findValidation, listValidations } from "@/api/validations";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { usePagedList } from "@/hooks/use-paged-list";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

export const validationsQueryKey = ["validations"] as const;

export function useValidationsQuery(query: ValidationQuery) {
  return usePagedList([...validationsQueryKey, "list", query], (cursor) =>
    listValidations(query, { cursor }),
  );
}

export function useValidationQuery(iterationId: string | null) {
  return useQuery({
    queryKey: [...validationsQueryKey, "detail", iterationId],
    queryFn: iterationId === null ? skipToken : () => findValidation(iterationId),
  });
}

// What an act on an iteration here changes.
export const validationInvalidations = [validationsQueryKey, documentsQueryKey, watchlistsQueryKey];
