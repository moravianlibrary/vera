// Documents within the caller's reach, for one query: the list a slice at a time, arranged as
// asked, and one record.

import { keepPreviousData, skipToken, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { DocumentGrouping, DocumentQuery } from "@/api/documents";
import { findDocument, listDocuments } from "@/api/documents";

export const documentsQueryKey = ["documents"] as const;

export function useDocumentsQuery(query: DocumentQuery, grouping: DocumentGrouping | null) {
  return useInfiniteQuery({
    queryKey: [...documentsQueryKey, "list", query, grouping],
    queryFn: ({ pageParam }) => listDocuments(query, { grouping, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous rows on screen while a new search is fetched.
    placeholderData: keepPreviousData,
  });
}

export function useDocumentQuery(documentId: string | null) {
  return useQuery({
    queryKey: [...documentsQueryKey, "detail", documentId],
    queryFn: documentId === null ? skipToken : () => findDocument(documentId),
  });
}
