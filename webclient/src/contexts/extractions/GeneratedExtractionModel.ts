import { format } from "date-fns";
import { GeneratedExtraction } from "../../adapters/ApiGeneratedExtractions";

class GeneratedExtractionModel implements GeneratedExtraction {
    id: number;
    document_ids: number[];
    documents_count: number;
    selected_pages: number;
    target_pages: number;
    include_categories: number[];
    location_ids: number[];
    target_pages_threshold: number;
    whole_categories_threshold: number;
    generated_by: string;
    generated_at: string;

    constructor(data: GeneratedExtraction) {
        this.id = data.id;
        this.document_ids = data.document_ids;
        this.documents_count = data.document_ids.length;
        this.selected_pages = data.selected_pages;
        this.include_categories = data.include_categories;
        this.target_pages_threshold = data.target_pages_threshold;
        this.whole_categories_threshold = data.whole_categories_threshold;
        this.target_pages = data.target_pages;
        this.generated_by = data.generated_by;
        this.generated_at = GeneratedExtractionModel.formatDatetime(data.generated_at);
    }

    static formatDatetime(datetime: string) {
        return format(new Date(datetime), 'dd.MM.yyyy HH:mm:ss');
    }
}

export default GeneratedExtractionModel;
