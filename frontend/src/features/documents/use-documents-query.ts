// Documents within the caller's reach, for one query: the list a slice at a time, arranged as
// asked, and one record.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { DocumentGrouping, DocumentQuery } from "@/api/documents";
import { findDocument, listDocuments } from "@/api/documents";
import { usePagedList } from "@/hooks/use-paged-list";

export const documentsQueryKey = ["documents"] as const;

export function useDocumentsQuery(query: DocumentQuery, grouping: DocumentGrouping | null) {
  return usePagedList([...documentsQueryKey, "list", query, grouping], (cursor) =>
    listDocuments(query, { grouping, cursor }),
  );
}

export function useDocumentQuery(documentId: string | null) {
  return useQuery({
    queryKey: [...documentsQueryKey, "detail", documentId],
    queryFn: documentId === null ? skipToken : () => findDocument(documentId),
  });
}
