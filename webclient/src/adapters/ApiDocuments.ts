import AddDocumentResponseStatus from "../types/AddDocumentResponseStatus";
import { DigitizationState } from "../types/DigitizationState";
import { DocumentCreateResult } from "../types/DocumentCreateResult";
import { DocumentField } from "../types/DocumentSearchField";
import { IdentifierType } from "../types/IdentifierType";
import { IssuanceType } from "../types/IssuanceType";
import { MaterialType } from "../types/MaterialType";
import axiosInstance, { ApiBase, ApiOptions, authHeader } from "./ApiBase";

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

    is_extractable: boolean;
    extraction_id: number | null;
    extractor: string | null;
    extracted_at: string | null;
}

interface IndexDocument {
    id: string;
    // Main identifiers
    sysno: string;
    barcode: string | null;
    volume: string | null;
    volume_number: number | null;
    volume_year: string | null;
    volume_year_number: number | null;
    bundle: string | null;
    bundle_number: number | null;
    // Librarian identifiers
    cnb: string | null;
    language: string | null;
    signature: string | null;
    isxn: string | null;
    // VERA properties
    added_at: string;
    added_by: string;
    category_id: number | null;
    category_path: any;
    // Catalog properties
    skc_sysno: string | null;
    skc_diff: any;
    has_valid_main_record: boolean;
    cnb_sysno: string | null;
    cnb_diff: any;
    has_valid_cnb: boolean;
    digitization_registry_id: number | null;
    digitization_state: DigitizationState;
    // Page count
    page_count: number | null;
    page_count_catalog: number | null;
    page_count_manual: number | null;
    page_count_predicted: number | null;
    // Extraction properties
    dedicated_scanner: string | null;
    extraction_priority: number | null;
    is_extractable: boolean;
    digitization_list_id: number | null;
    // Other properties
    material_type: MaterialType;
    issuance_type: IssuanceType;
    title: string;
    size: string | null;
    location_uri: string | null;
    // Publication properties
    publisher: string | null;
    publishing_place: string | null;
    publishing_year: string | null;
    languages: string[] | null;
    frequencies: any;
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

interface CatalogIssueResponse {
    issuance_type: IssuanceType;
    barcode?: string | null;
    volume?: string | null;
    volume_year?: string | null;
    bundle?: string | null;
    signature?: string | null;

    document_id?: number | null;
    page_count?: number | null;

    digitization_registry_id?: number | null;
    digitization_state: DigitizationState;
    can_digitize: boolean;
    already_added: boolean;
    newly_added: boolean;
}

interface CatalogDocumentResponse {
    sysno: string;
    title: string;
    material_type: MaterialType;
    issues: CatalogIssueResponse[];
    skc_sysno: string | null;
    has_valid_main_record: boolean;
    cnb_sysno: string | null;
    has_valid_cnb: boolean;
}

interface CatalogDocument extends DocumentBase {
    issues: Issue[];
}

interface AddDocumentResponse {
    identifier: Identifier;
    status: AddDocumentResponseStatus;
    document?: CatalogDocumentResponse | null;
}

class ApiDocuments extends ApiBase<Document> {
    constructor() {
        super("/documents", {
            disableCreate: true,
            disableUpdate: true,
            disableGetPage: true,
        } as ApiOptions);
    }

    static queryDocuments(queryParams: Object) {
        const url = "/documents/query";
        return ApiBase.axiosInstance.post(url, queryParams, {
            headers: authHeader(),
        });
    }

    insertDocument(
        identifier: Identifier,
        category_id: number | null,
        insert_digitized: boolean
    ) {
        const url =
            category_id !== null
                ? `/documents/from_catalog?category_id=${category_id}&insert_digitized=${insert_digitized}`
                : `/documents/from_catalog?insert_digitized=${insert_digitized}`;
        // : `/catalogs?insert_digitized=${insert_digitized}`;

        return axiosInstance.post<AddDocumentResponse>(url, identifier, {
            headers: authHeader(),
        });
    }

    deleteDocuments(queryParams: Object) {
        const url = `${this.endpoint}/query/delete`;
        return ApiBase.axiosInstance.post<Object>(url, queryParams, {
            headers: authHeader(),
        });
    }

    updateCategory(queryParams: Object, category_id: number) {
        const url = `${this.endpoint}/query/change_category?category_id=${category_id}`;
        return ApiBase.axiosInstance.put<Object>(url, queryParams, {
            headers: authHeader(),
        });
    }

    exportDocuments(queryParams: Object) {
        const url = `${this.endpoint}/query/export`;
        return ApiBase.axiosInstance.post<Blob>(url, queryParams, {
            headers: authHeader(),
            responseType: "blob",
        });
    }
}

export default ApiDocuments;
export type {
    Identifier,
    DocumentBase,
    Document,
    Issue,
    CatalogDocument,
    DocumentsResponse,
    Frequency,
    IndexDocument,
    AddDocumentResponse,
    CatalogIssueResponse,
    CatalogDocumentResponse,
};
