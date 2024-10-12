import { ApiBase, ApiOptions } from "./ApiBase";
import { DigitizationState } from "../types/DigitizationState";

interface ExtractionParameters {
    target_pages: number;
    ignore_digitization_states: DigitizationState[];
    include_categories: number[];
    location_ids: number[];
    target_pages_threshold: number;
    whole_categories_threshold: number;
}

interface Extraction extends ExtractionParameters {
    id: number;
    document_ids: number[];
    selected_pages: number;
    generated_by: string;
    generated_at: string;
}

class ApiExtractions extends ApiBase<Extraction> {
    constructor() {
        super("/extractions/generated", {
            disableUpdate: true,
        } as ApiOptions);
    }
}

export default ApiExtractions;
export type { Extraction, ExtractionParameters };
