import axiosInstance, { authHeader } from "./ApiBase";

interface ExtractionCreate {
    target_pages_threshold: number;
    whole_categories_threshold: number;
    include_whole_categories: boolean;
    balance_total_pages: boolean;
    include_categories: number[];
}

interface Extraction {
    id: number;
    extractor: string;
    extracted_at: string;
    document_ids: number[];
}

interface Extractions {
    extractions: Extraction[];
    num_found: number;
}

namespace ApiExtractions {
    export function getExtractions(offset: number, rows: number) {
        return axiosInstance.get<Extractions>(
            `/extractions?offset=${offset}&limit=${rows}`,
            { headers: authHeader() }
        );
    }

    export function generateExtraction(createProps: ExtractionCreate,
                pages_count: number | null = null,
                quota_id: number | null = null) {
        const params: string[][] = [];
        if (pages_count !== null) {
            params['pages_count'] = String(pages_count);
        }
        if (quota_id !== null) {
            params['quota_id'] = String(quota_id);
        }
        const queryParams = new URLSearchParams(params).toString();
        const url = `/extract/generate${queryParams ? `?${queryParams}` : ''}`;
        return axiosInstance.put<Extraction>(url, createProps, { headers: authHeader() });
    }

    export function markExtracted(id: number) {
        return axiosInstance.post(`/extractions/${id}/mark`, { headers: authHeader() });
    }

    export function unmarkExtracted(id: number) {
        return axiosInstance.post(`/extractions/${id}/unmark`, { headers: authHeader() });
    }
}

export default ApiExtractions;
export type { Extraction };
