import { format } from "date-fns";
import { DigitizationExtraction } from "../../adapters/ApiDigitizationExtractions";

class DigitizationListModel implements DigitizationExtraction {
    id: number;
    document_ids: number[];
    documents_count: number;
    extracted_pages: number;
    intention_id: number | null;
    extractor: string;
    extracted_at: string;

    constructor(data: DigitizationExtraction) {
        this.id = data.id;
        this.document_ids = data.document_ids;
        this.documents_count = data.document_ids.length;
        this.extracted_pages = data.extracted_pages;
        this.intention_id = data.intention_id;
        this.extractor = data.extractor;
        this.extracted_at = DigitizationListModel.formatDatetime(data.extracted_at);
    }

    static formatDatetime(datetime: string) {
        return format(new Date(datetime), 'dd.MM.yyyy HH:mm:ss');
    }
}

export default DigitizationListModel;
