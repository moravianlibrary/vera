import { DocumentField } from "../contexts/documents/search/DocumentSearchField";
import { GroupOption, SearchGroupParams } from "../contexts/documents/search/SearchNodes";
import { DigitizationState } from "../types/DigitizationState";
import { DocumentCreateResult } from "../types/DocumentCreateResult";
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

    ccnb: string | null;
    isbn_issn: string | null;
    signature: string | null;

    material_type: MaterialType;
    issuance_type: IssuanceType;
    title: string;
    digitization_state: DigitizationState;
    
    year: string | null;
    bundle: string | null;

    pages_count: number | null;
    size: string | null;

    publishers: string[];
    publishing_places: string[];

    publisher: string | null;
    publishing_place: string | null;
    publishing_year: string | null;
    languages: string[];

    frequencies: Frequency[] | null;
}

interface Document extends DocumentBase {
    id: number;
    category_id: number | null;
    category_name: string | null;

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

    export function getDocuments(offset: number, rows: number) {
        return axiosInstance.get<DocumentsResponse>(`/documents?offset=${offset}&limit=${rows}`, { headers: authHeader() });
    }

    export function createDocument(document: Document) {
        return axiosInstance.post<DocumentCreationResponse>("/documents", document, { headers: authHeader() });
    }

    export function updateDocument(document: Document) {
        return axiosInstance.put<Document>(`/documents/${document.id}`, document, { headers: authHeader() });
    }

    export function deleteDocument(id: number) {
        return axiosInstance.delete<Document>(`/documents/${id}`, { headers: authHeader() });
    }

    export function insertDocument(identifier: Identifier, category_id: number | null, insert_digitized: boolean) {
        console.log(identifier);
        const url = category_id !== null
            ? `/catalogs?category_id=${category_id}&insert_digitized=${insert_digitized}`
            : `/catalogs?insert_digitized=true`;
            // : `/catalogs?insert_digitized=${insert_digitized}`;

        return axiosInstance.post<DocumentCreationResponse>(url, identifier, { headers: authHeader() });
    }

    export function insertDocumentsFile(formData: FormData, insert_digitized: boolean, category_id?: number | null) {
        const url = category_id !== null
            ? `/catalogs/list?category_id=${category_id}&insert_digitized=${insert_digitized}`
            : `/catalogs/list?insert_digitized=${insert_digitized}`;

        return axiosInstance.post<DocumentCreationResponse[]>(url, formData, { headers: authHeader() });
    }
}

export default ApiDocuments;
export type { Identifier, DocumentBase, Document, Issue, CatalogDocument, DocumentCreationResponse, DocumentsQuery, Frequency };
