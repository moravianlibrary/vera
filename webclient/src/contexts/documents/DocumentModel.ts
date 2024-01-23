import { format } from "date-fns";
import { Document } from "../../adapters/ApiDocuments";

class DocumentModel implements Document {
    id: number;
    sysno: string;
    volume_number: string | null;
    signature: string | null;
    barcode: string;
    ccnb: string | null;
    isbn: string | null;
    material_type: string;
    title: string;
    publishers: string[];
    publishing_dates: string[];
    places: string[];
    languages: string[];
    frequencies: string[];
    pages_count: number | null;
    size: string | null;
    category_id: number | null;
    category_name: string | null;
    pages_count_predicted: number | null;
    dedicated_scanner: string | null;
    created_at: string;
    creator: string;
    department: string | null;
    extraction_id: number | null;
    extractor: string | null;
    extracted_at: string | null;

    constructor(data: Document) {
        this.id = data.id;
        this.sysno = data.sysno;
        this.volume_number = data.volume_number ? decodeURIComponent(data.volume_number) : null;

        this.signature = data.signature ? decodeURIComponent(data.signature) : null;
        this.ccnb = data.ccnb;
        this.isbn = data.isbn;
        this.barcode = data.barcode;
    
        this.material_type = data.material_type;
        this.title = decodeURIComponent(data.title);

        this.publishers = data.publishers;
        this.publishing_dates = data.publishing_dates;
        this.places = data.places;
        this.languages = data.languages;
        this.frequencies = data.frequencies;

        this.pages_count = data.pages_count;
        this.size = data.size;

        this.category_id = data.category_id;
        this.category_name = data.category_name ? decodeURIComponent(data.category_name) : null;

        this.pages_count_predicted = data.pages_count_predicted;
        this.dedicated_scanner = data.dedicated_scanner

        this.created_at = DocumentModel.formatDatetime(data.created_at)!;
        this.creator = data.creator;
        this.department = data.department;

        this.extraction_id = data.extraction_id;
        this.extractor = data.extractor;
        this.extracted_at = DocumentModel.formatDatetime(data.extracted_at);
    }

    static formatDatetime(datetime: string | null) {
        return datetime ? format(new Date(datetime), 'dd.MM.yyyy HH:mm:ss') : null;
    }

    toJson() {
    }
}

export default DocumentModel;
