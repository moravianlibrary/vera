import axiosInstance, { authHeader } from "./ApiBase";

interface GenerateExtraction {
    include_categories: number[];
    location_ids: number[];
    target_pages_threshold: number;
    whole_categories_threshold: number;
}

interface GeneratedExtraction extends GenerateExtraction {
    id: number;
    document_ids: number[];
    selected_pages: number;
    target_pages: number;
    generated_by: string;
    generated_at: string;
}

interface GeneratedExtractions {
    extractions: GeneratedExtraction[];
    num_found: number;
}

namespace ApiGeneratedExtractions {
    export function getExtractions(offset: number, rows: number) {
        return axiosInstance.get<GeneratedExtractions>(
            `/extractions/generated?offset=${offset}&limit=${rows}`,
            { headers: authHeader() }
        );
    }

    export function getExtraction(id: number) {
        return axiosInstance.get<GeneratedExtraction>(`/extractions/generated/${id}`, { headers: authHeader() });
    }

    export function generateExtraction(createProps: GenerateExtraction, pages_count?: number, quota_id?: number) {
        const params: { [key: string]: string } = {}
        if (pages_count) {
            params['pages_count'] = String(pages_count);
        }
        if (quota_id) {
            params['quota_id'] = String(quota_id);
        }
        const queryParams = new URLSearchParams(params).toString();
        const url = `/extractions/generated${queryParams ? `?${queryParams}` : ''}`;
        return axiosInstance.post<GeneratedExtraction>(url, createProps, { headers: authHeader() });
    }

    export function deleteExtraction(id: number) {
        return axiosInstance.delete<GeneratedExtraction>(`/extractions/generated/${id}`, { headers: authHeader() });
    }
}

export default ApiGeneratedExtractions;
export type { GenerateExtraction, GeneratedExtraction, GeneratedExtractions };
