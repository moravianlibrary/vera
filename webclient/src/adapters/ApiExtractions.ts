import { ApiBase, ApiOptions } from "./ApiBase";
import { DigitizationState } from "../types/DigitizationState";

interface Extraction {
    id: number;
    document_ids: number[];
    selected_pages: number;
    generated_by: string;
    generated_at: string;
    // Extraction parameters
    target_pages: number;
    ignore_digitization_states: DigitizationState[];
    include_categories: number[];
    location_ids: number[];
    target_pages_threshold: number;
    whole_categories_threshold: number;
}

class ApiExtractions extends ApiBase<Extraction> {
    constructor() {
        super("/extractions/generated", {
            disableUpdate: true,
        } as ApiOptions);
    }
}

export default ApiExtractions;
export type { Extraction };
