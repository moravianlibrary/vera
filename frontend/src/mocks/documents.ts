// What the server does for the Documents resource: assemble one record per document, keep it
// to the caller's reach (the scope of `iteration.read` for staff), withhold what their grants do not cover, then search, filter, count,
// sort and group. Kept apart from the handlers so it can be tested without HTTP.

import type {
  DocumentDetail,
  DocumentGrouping,
  DocumentPage,
  DocumentQuery,
  DocumentSlice,
} from "@vera/contract/documents";
import {
  audienceOf as queryAudienceOf,
  findDocumentDetail as queryFindDocumentDetail,
  publicPropertiesOf as queryPublicPropertiesOf,
  queryDocuments as queryQueryDocuments,
  recordOf as queryRecordOf,
} from "@vera/contract/queries/documents";
import type { Audience, DocumentRecord } from "@vera/domain/documents";
import type { Document, Session } from "@vera/domain/entities";
import type { PropertyValues } from "@vera/domain/properties";
import { mockStore } from "@/mocks/database";

export function queryDocuments(
  session: Session,
  query: DocumentQuery,
  slice?: Required<DocumentSlice>,
  grouping: DocumentGrouping | null = null,
  requestedAudience?: Audience,
): DocumentPage {
  return queryQueryDocuments(mockStore(), session, query, slice, grouping, requestedAudience);
}

export function findDocumentDetail(
  session: Session,
  documentId: string,
  requestedAudience?: Audience,
): DocumentDetail | null {
  return queryFindDocumentDetail(mockStore(), session, documentId, requestedAudience);
}

export function audienceOf(session: Session): Audience {
  return queryAudienceOf(mockStore(), session);
}

export function recordOf(document: Document): DocumentRecord {
  return queryRecordOf(mockStore(), document);
}

export function publicPropertiesOf(properties: readonly PropertyValues[]): PropertyValues[] {
  return queryPublicPropertiesOf(mockStore(), properties);
}
