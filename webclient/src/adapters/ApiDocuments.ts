import { DigitizationState } from "../types/DigitizationState";
import { DocumentCreationStatus } from "../types/DocumentCreationStatus";
import { IdentifierType } from "../types/IdentifierType";
import { IssuanceType } from "../types/IssuanceType";
import axiosInstance, { authHeader } from "./ApiBase";

interface Identifier {
    identifier_type: IdentifierType;
    value: string;
}

interface DocumentBase {
    sysno: string;
    volume_number: string | null;

    signature: string | null;
    barcode: string;
    ccnb: string | null;
    isbn: string | null;

    material_type: string;
    title: string;

    publishers: string[];
    publishing_dates: string[];
    places: string[];
    languages: string[];
    frequencies: string[];

    pages_count: number | null;
    size: string | null;

    // digitization_state: string;
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
    barcode: string;
    signature?: string | null;
    year_issued?: string | null;
    volume?: string | null;
    item?: string | null;
    issuance_type: IssuanceType;
    digitization_state?: DigitizationState | null;
    already_exists: boolean;
}

interface CatalogDocument extends DocumentBase {
    issues: Issue[];
}

interface DocumentCreationResponse {
    identifier: Identifier;
    document?: Document | null;
    catalog_document?: CatalogDocument | null;
    digitization_state?: DigitizationState | null;
    create_result: DocumentCreationStatus;
}

interface DocumentsQuery {
    id_list?: number[];
}

namespace ApiDocuments {
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
            ? `/documents/create_from_catalog?category_id=${category_id}&insert_digitized=${insert_digitized}`
            : `/documents/create_from_catalog?insert_digitized=${insert_digitized}`;

        return axiosInstance.post<DocumentCreationResponse>(url, identifier, { headers: authHeader() });
    }

    export function insertDocumentsFile(formData: FormData, insert_digitized: boolean, category_id?: number | null) {
        const url = category_id !== null
            ? `/documents/create_from_catalog?category_id=${category_id}&insert_digitized=${insert_digitized}`
            : `/documents/create_from_catalog?insert_digitized=${insert_digitized}`;

        return axiosInstance.post<DocumentCreationResponse[]>(url, formData, { headers: authHeader() });
    }
}

export default ApiDocuments;
export type { Identifier, DocumentBase, Document, Issue, CatalogDocument, DocumentCreationResponse, DocumentsQuery };
