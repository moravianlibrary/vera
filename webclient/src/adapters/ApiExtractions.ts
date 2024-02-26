import axiosInstance, { authHeader } from "./ApiBase";

interface ExtractionProps {
    target_pages_threshold: number;
    whole_categories_threshold: number;
    balance_total_pages: boolean;
    include_categories: number[];
}

interface Extraction {
    id: number;
    extractor: string;
    extracted_at: string;
    marked: boolean;
    target_pages: number;
    extracted_pages: number;
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

    export function generateExtraction(createProps: ExtractionProps, pages_count?: number, quota_id?: number) {
        const params: { [key: string]: string } = {}
        if (pages_count) {
            params['pages_count'] = String(pages_count);
        }
        if (quota_id) {
            params['quota_id'] = String(quota_id);
        }
        const queryParams = new URLSearchParams(params).toString();
        console.log(queryParams);
        const url = `/extractions/generate${queryParams ? `?${queryParams}` : ''}`;
        console.log(url);
        return axiosInstance.post<Extraction>(url, createProps, { headers: authHeader() });
    }

    export function getExtraction(id: number) {
        return axiosInstance.get<Extraction>(`/extractions/${id}`, { headers: authHeader() });
    }

    export function markExtracted(id: number) {
        return axiosInstance.post(`/extractions/${id}/mark`, { headers: authHeader() });
    }

    export function unmarkExtracted(id: number) {
        return axiosInstance.post(`/extractions/${id}/unmark`, { headers: authHeader() });
    }
}

export default ApiExtractions;
export type { ExtractionProps, Extraction, Extractions };
