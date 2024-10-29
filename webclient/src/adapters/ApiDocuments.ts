import AddDocumentResponseStatus from "../types/AddDocumentResponseStatus";
import { DigitizationState } from "../types/DigitizationState";
import DocumentFlag from "../types/DocumentFlag";
import { IdentifierType } from "../types/IdentifierType";
import { IssuanceType } from "../types/IssuanceType";
import { MaterialType } from "../types/MaterialType";
import axiosInstance, { ApiBase, ApiOptions, authHeader } from "./ApiBase";

interface Identifier {
    identifier_type: IdentifierType;
    value: string;
}

interface IdentifierWithAttributes extends Identifier {
    category_id: number;
    extraction_priority?: number;
    page_count_manual?: number;
}

interface Frequency {
    frequency: string;
    date: string | null;
}

interface CategoryPathItem {
    category_id: number;
    category_name: string;
}
type CategoryPath = CategoryPathItem[];

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
    indexed_at: string;
    category_id: number | null;
    category_path: CategoryPath;
    document_flags: DocumentFlag[];
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

interface AddDocumentResponse {
    attributes: IdentifierWithAttributes;
    status: AddDocumentResponseStatus;
    document?: CatalogDocumentResponse | null;
    added_by: string;
    indexed_at: string;
}

interface UpdateDocumentsOptions {
    category_id?: number;
    extraction_priority?: number;
    pages_count_manual?: number;
}

type UpdateAttributes =
    | "category_id"
    | "extraction_priority"
    | "page_count_manual";

class ApiDocuments extends ApiBase<IndexDocument> {
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
        attributes: IdentifierWithAttributes | IdentifierWithAttributes[]
    ) {
        const url = "/documents/from_catalog";
        return axiosInstance.post(url, attributes, {
            headers: authHeader(),
        });
    }

    searchAddDocumentsResponses(queryParams: Object) {
        const url = "/documents/from_catalog/responses";
        return ApiBase.axiosInstance.post(url, queryParams, {
            headers: authHeader(),
        });
    }

    deleteAddDocumentsResponses(queryParams: Object) {
        const url = `${this.endpoint}/query/from_catalog/responses`;
        return ApiBase.axiosInstance.post<Object>(url, queryParams, {
            headers: authHeader(),
        });
    }

    updateDocument(documentId: string, options: UpdateDocumentsOptions) {
        const endpoint = `${this.endpoint}/${documentId}`;
        const queryString = Object.entries(options)
            .filter(([, value]) => value !== undefined)
            .map(
                ([key, value]) =>
                    `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            )
            .join("&");
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return ApiBase.axiosInstance.put<Object>(url, null, {
            headers: authHeader(),
        });
    }

    deleteDocuments(queryParams: Object) {
        const url = `${this.endpoint}/query/delete`;
        return ApiBase.axiosInstance.post<Object>(url, queryParams, {
            headers: authHeader(),
        });
    }

    updateProperty(queryParams: Object, options: UpdateDocumentsOptions) {
        const endpoint = `${this.endpoint}/query/update_property`;
        const queryString = Object.entries(options)
            .filter(([, value]) => value !== undefined)
            .map(
                ([key, value]) =>
                    `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            )
            .join("&");
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
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
    IdentifierWithAttributes,
    Frequency,
    IndexDocument,
    AddDocumentResponse,
    CatalogIssueResponse,
    CatalogDocumentResponse,
    CategoryPath,
    UpdateAttributes,
};
