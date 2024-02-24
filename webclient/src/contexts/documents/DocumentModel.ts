import { format } from "date-fns";
import { Document, Frequency } from "../../adapters/ApiDocuments";
import { DigitizationState } from "../../types/DigitizationState";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";

class DocumentModel implements Document {
    id: number;

    sysno: string;
    volume: string | null;
    barcode: string | null;

    ccnb: string | null;
    isbn_issn: string | null;
    signature: string | null;

    material_type: MaterialType;
    issuance_type: IssuanceType;
    title: string;
    digitization_state: DigitizationState;

    year: string | null;
    bundle: string | null;

    pages_count: number | null;
    size: string | null;

    publishers: string[];
    publishing_places: string[];

    publisher: string | null;
    publishing_place: string | null;
    publishing_year: string | null;
    languages: string[];

    frequencies: Frequency[] | null;

    category_id: number | null;
    category_name: string | null;
    created_at: string;
    creator: string;
    department: string | null;

    pages_count_predicted: number | null;
    dedicated_scanner: string | null;

    extraction_id: number | null;
    extractor: string | null;
    extracted_at: string | null;

    constructor(data: Document) {
        this.id = data.id;

        this.sysno = data.sysno;
        this.volume= data.volume ? decodeURIComponent(data.volume) : null;
        this.barcode = data.barcode;

        this.signature = data.signature ? decodeURIComponent(data.signature) : null;
        this.ccnb = data.ccnb;
        this.isbn_issn = data.isbn_issn;
    
        this.material_type = data.material_type;
        this.issuance_type = data.issuance_type;
        this.title = decodeURIComponent(data.title);
        this.digitization_state = data.digitization_state;

        this.pages_count = data.pages_count;
        this.size = data.size;

        this.publishers = data.publishers;
        this.publishing_places = data.publishing_places;

        this.publisher = data.publisher;
        this.publishing_place = data.publishing_place;
        this.publishing_year = data.publishing_year;
        this.languages = data.languages;
        this.frequencies = data.frequencies;

        this.category_id = data.category_id;
        this.category_name = data.category_name ? decodeURIComponent(data.category_name) : null;

        this.created_at = DocumentModel.formatDatetime(data.created_at)!;
        this.creator = data.creator;
        this.department = data.department;

        this.pages_count_predicted = data.pages_count_predicted;
        this.dedicated_scanner = data.dedicated_scanner

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
