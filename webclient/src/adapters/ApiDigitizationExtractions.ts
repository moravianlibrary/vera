import axiosInstance, { authHeader } from "./ApiBase";
import { DocumentsQuery } from "./ApiDocuments";

interface DigitizationExtraction {
    id: number;
    document_ids: number[];
    extracted_pages: number;
    intention_id: number | null;
    extractor: string;
    extracted_at: string;
}

interface DigitizationExtractions {
    extractions: DigitizationExtraction[];
    num_found: number;
}

namespace ApiDigitizationExtractions {
    export function getExtractions(offset: number, rows: number) {
        return axiosInstance.get<DigitizationExtractions>(
            `/extractions/digitization?offset=${offset}&limit=${rows}`,
            { headers: authHeader() }
        );
    }

    export function getExtraction(id: number) {
        return axiosInstance.get<DigitizationExtraction>(`/extractions/digitization/${id}`, { headers: authHeader() });
    }

    export function createExtraction(query: DocumentsQuery, intention_id?: number) {
        const url = `/extractions/digitization${intention_id ? `?intention_id=${intention_id}` : ''}`;
        return axiosInstance.post<DigitizationExtraction>(url, query, { headers: authHeader() });
    }

    export function addDocumentsToExtraction(extraction_id: number, query: DocumentsQuery) {
        const url = `/extractions/digitization/${extraction_id}/add_documents`;
        return axiosInstance.put<DigitizationExtraction>(url, query, { headers: authHeader() });
    }

    export function removeDocumentsFromExtraction(extraction_id: number, query: DocumentsQuery) {
        const url = `/extractions/digitization/${extraction_id}/remove_documents`;
        return axiosInstance.put<DigitizationExtraction>(url, query, { headers: authHeader() });
    }

    export function deleteExtraction(id: number) {
        return axiosInstance.delete<DigitizationExtraction>(`/extractions/digitization/${id}`, { headers: authHeader() });
    }
}

export default ApiDigitizationExtractions;
export type { DigitizationExtraction, DigitizationExtractions };
