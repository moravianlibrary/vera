import { SearchGroupParams } from "../contexts/documents/search/SearchNodes";
import { DigitizationState } from "../types/DigitizationState";
import { DocumentCreateResult } from "../types/DocumentCreateResult";
import { DocumentField } from "../types/DocumentSearchField";
import { IdentifierType } from "../types/IdentifierType";
import { IssuanceType } from "../types/IssuanceType";
import { MaterialType } from "../types/MaterialType";
import axiosInstance, { authHeader } from "./ApiBase";

interface Identifier {
    identifier_type: IdentifierType;
    value: string;
}

interface Frequency {
    frequency: string;
    date: string | null;
}

interface DocumentBase {
    sysno: string;
    volume: string | null;
    barcode: string | null;

    cnb: string | null;
    isbn_issn: string | null;
    signature: string | null;

    material_type: MaterialType;
    issuance_type: IssuanceType;
    title: string;
    digitization_state: DigitizationState;
    
    year: string | null;
    bundle: string | null;

    pages_count_manual: number | null;
    size: string | null;
    locationUri: string | null;

    publishers: string[];
    publishing_places: string[];

    publisher: string | null;
    publishing_place: string | null;
    publishing_year: string | null;
    languages: string[] | null;

    frequencies: Frequency[] | null;
}

interface Document extends DocumentBase {
    id: number;
    category_id: number | null;
    category_name: string | null;

    pages_count_catalog: number | null;
    pages_count_predicted: number | null;
    dedicated_scanner: string | null;

    created_at: string;
    creator: string;
    department: string | null;

    extraction_id: number | null;
    extractor: string | null;
    extracted_at: string | null;
}

interface DocumentsResponse {
    documents: Document[];
    num_found: number;
}

interface Issue {
    type: IssuanceType;
    barcode: string;
    signature?: string | null;
    year?: string | null;
    volume?: string | null;
    bundle?: string | null;
    digitization_state: DigitizationState | null;
    already_exists: boolean;
    can_digitize: boolean;
}

interface CatalogDocument extends DocumentBase {
    issues: Issue[];
}

interface DocumentCreationResponse {
    document?: Document | null;
    catalog_document?: CatalogDocument | null;
    create_result: DocumentCreateResult;
}

interface QuerySort {
    field: DocumentField;
    and_then?: QuerySort;
}

interface DocumentsQuery {
    id_list?: number[];
    search_phrase?: string;
    search_group?: SearchGroupParams;
    sort?: QuerySort;
}

namespace ApiDocuments {
    export function queryDocuments(query: DocumentsQuery, offset: number, rows: number) {
        return axiosInstance.post<DocumentsResponse>(
            `/documents/query?offset=${offset}&limit=${rows}`,
            query,
            { headers: authHeader("application/json") }
        );
    }

    export function getDocuments(offset: number, rows: number, signal?: AbortSignal) {
        return axiosInstance.get<DocumentsResponse>(`/documents?offset=${offset}&limit=${rows}`, { headers: authHeader(), signal: signal });
    }

    export function createDocument(document: Document) {
        return axiosInstance.post<DocumentCreationResponse>("/documents/new", document, { headers: authHeader() });
    }

    export function updateDocument(document: Document) {
        return axiosInstance.put<Document>(`/documents/${document.id}`, document, { headers: authHeader() });
    }

    export function deleteDocument(id: number) {
        return axiosInstance.delete<Document>(`/documents/${id}`, { headers: authHeader() });
    }

    export function insertDocument(identifier: Identifier, category_id: number | null, insert_digitized: boolean) {
        const url = category_id !== null
            ? `/documents/from_catalog?category_id=${category_id}&insert_digitized=${insert_digitized}`
            : `/documents/from_catalog?insert_digitized=${insert_digitized}`;
            // : `/catalogs?insert_digitized=${insert_digitized}`;

        return axiosInstance.post<DocumentCreationResponse>(url, identifier, { headers: authHeader() });
    }

    export function insertDocumentsList(identifier_type: IdentifierType, values: string[], category_id?: number | null, insert_digitized?: boolean) {
        let url = "/catalogs/list?"
        url += `identifier_type=${identifier_type}&`;
        url += `values=${values.join(",")}&`;
        if (category_id) {
            url += `category_id=${category_id}&`
        }
        url += `insert_digitized=${insert_digitized}`;

        return axiosInstance.post<DocumentCreationResponse[]>(url, { headers: authHeader() });
    }

    export function deleteDocuments(query: DocumentsQuery) {
        return axiosInstance.post<DocumentsQuery>(
            `/documents/query/delete`,
            query,
            { headers: authHeader("application/json") }
        );
    }

    export function updateCategory(query: DocumentsQuery, category_id: number) {
        return axiosInstance.put<DocumentsQuery>(
            `/documents/query/change_category?category_id=${category_id}`,
            query,
            { headers: authHeader("application/json") }
        );
    }

    export function exportDocuments(query: DocumentsQuery) {
        return axiosInstance.post<Blob>(
            `/documents/query/export`,
            query,
            { headers: authHeader("application/json"), responseType: 'blob' }
        );
    }
}

export default ApiDocuments;
export type { Identifier, DocumentBase, Document, Issue, CatalogDocument, DocumentCreationResponse, DocumentsQuery, DocumentsResponse, Frequency };
