import { ApiBase, ApiOptions, authHeader } from "./ApiBase";
import { DocumentsQuery } from "./ApiDocuments";

interface DigitizationExtraction {
    id: number;
    document_ids: number[];
    page_count: number;
    intention_id: number | null;
    created_by: string;
    created_at: string;
}

class ApiDigitizationLists extends ApiBase<DigitizationExtraction> {
    constructor() {
        super("/extractions/digitization", {
            disableCreate: true,
            disableUpdate: true,
        } as ApiOptions);
    }

    createFromQuery(query: DocumentsQuery, intention_id?: number) {
        const url = intention_id
            ? `${this.endpoint}?intention_id=${intention_id}`
            : this.endpoint;
        return ApiBase.axiosInstance.post<DigitizationExtraction>(url, query, {
            headers: authHeader(),
        });
    }

    addDocumentsToExtraction(extraction_id: number, query: DocumentsQuery) {
        const url = `${this.endpoint}/${extraction_id}/add_documents`;
        return ApiBase.axiosInstance.put<DigitizationExtraction>(url, query, {
            headers: authHeader(),
        });
    }

    removeDocumentsFromExtraction(
        extraction_id: number,
        query: DocumentsQuery
    ) {
        const url = `${this.endpoint}/${extraction_id}/remove_documents`;
        return ApiBase.axiosInstance.put<DigitizationExtraction>(url, query, {
            headers: authHeader(),
        });
    }
}

export default ApiDigitizationLists;
export type { DigitizationExtraction };
