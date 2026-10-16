// Calls the documents endpoints; what they take and answer is in @vera/contract/documents.

import type {
  DocumentDetail,
  DocumentGrouping,
  DocumentPage,
  DocumentQuery,
  DocumentSlice,
} from "@vera/contract/documents";
import {
  documentDetailSchema,
  documentGroupingParam,
  documentPageSchema,
  documentPerspectiveParam,
  documentSliceParams,
  documentSliceSize,
  toDocumentSearchParams,
} from "@vera/contract/documents";
import { apiRoutes, documentRoute } from "@vera/contract/routes";
import { findJson, getJson } from "@/api/http";

interface DocumentListOptions extends Partial<DocumentSlice> {
  readonly grouping?: DocumentGrouping | null;
  readonly perspective?: "my";
}

export async function listDocuments(
  query: DocumentQuery,
  {
    grouping = null,
    cursor = null,
    limit = documentSliceSize,
    perspective,
  }: DocumentListOptions = {},
): Promise<DocumentPage> {
  const params = toDocumentSearchParams(query);
  if (perspective === "my") params.set(documentPerspectiveParam, "my");
  if (grouping !== null) {
    params.set(documentGroupingParam, grouping);
  }

  if (cursor !== null) {
    params.set(documentSliceParams.cursor, cursor);
  }

  params.set(documentSliceParams.limit, String(limit));
  return getJson(apiRoutes.documents, documentPageSchema, params);
}

// Null when the document does not exist or lies outside the caller's reach.
export async function findDocument(
  documentId: string,
  perspective?: "my",
): Promise<DocumentDetail | null> {
  const path = documentRoute(documentId);
  return findJson(
    perspective === "my" ? `${path}?${documentPerspectiveParam}=my` : path,
    documentDetailSchema,
  );
}
