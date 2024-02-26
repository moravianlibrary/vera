import { format } from "date-fns";
import { Extraction } from "../../adapters/ApiExtractions";

class ExtractionModel implements Extraction {
    id: number;
    extractor: string;
    extracted_at: string;
    marked: boolean;
    target_pages: number;
    extracted_pages: number;
    document_ids: number[];
    documents_count: number;

    constructor(data: Extraction) {
        this.id = data.id;
        this.extractor = data.extractor;
        this.extracted_at = ExtractionModel.formatDatetime(data.extracted_at);
        this.marked = data.marked;
        this.target_pages = data.target_pages;
        this.extracted_pages = data.extracted_pages;
        this.document_ids = data.document_ids;
        this.documents_count = data.document_ids.length;
    }

    static formatDatetime(datetime: string) {
        return format(new Date(datetime), 'dd.MM.yyyy HH:mm:ss');
    }
}

export default ExtractionModel;
