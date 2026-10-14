// Documents within the caller's reach, for one query: the list a slice at a time, arranged as
// asked, and one record.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { DocumentGrouping, DocumentQuery } from "@/api/documents";
import { findDocument, listDocuments } from "@/api/documents";
import { usePagedList } from "@/hooks/use-paged-list";

export const documentsQueryKey = ["documents"] as const;

export function useDocumentsQuery(
  query: DocumentQuery,
  grouping: DocumentGrouping | null,
  perspective?: "my",
) {
  return usePagedList([...documentsQueryKey, "list", perspective, query, grouping], (cursor) =>
    listDocuments(query, { grouping, cursor, perspective }),
  );
}

export function useDocumentQuery(documentId: string | null, perspective?: "my") {
  return useQuery({
    queryKey: [...documentsQueryKey, "detail", perspective, documentId],
    queryFn: documentId === null ? skipToken : () => findDocument(documentId, perspective),
  });
}
