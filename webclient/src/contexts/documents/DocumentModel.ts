import { format } from "date-fns";
import { Document, Frequency } from "../../adapters/ApiDocuments";
import { DigitizationState } from "../../types/DigitizationState";
import { MaterialType } from "../../types/MaterialType";
import { IssuanceType } from "../../types/IssuanceType";

interface DocumentTooltipField {
    label: string;
    value: string | number | null;
}

class DocumentModel implements Document {
    id: number;

    sysno: string;
    volume: string | null;
    barcode: string | null;

    cnb: string | null;
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
    locationUri: string | null;

    publishers: string[];
    publishing_places: string[];

    publisher: string | null;
    publishing_place: string | null;
    publishing_year: string | null;
    languages: string[] | null;

    frequencies: Frequency[] | null;

    category_id: number | null;
    category_name: string | null;
    creator: string;
    created_at: string;
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
        this.cnb = data.cnb;
        this.isbn_issn = data.isbn_issn;
    
        this.material_type = data.material_type;
        this.issuance_type = data.issuance_type;
        this.title = decodeURIComponent(data.title);
        this.digitization_state = data.digitization_state;

        this.year = data.year;
        this.bundle = data.bundle;

        this.pages_count = data.pages_count;
        this.size = data.size;
        this.locationUri = data.locationUri;

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

    static formatFrequencies(frequencies: Frequency[] | null) {
        return frequencies && frequencies!.length > 0 ? frequencies?.map((f) => 
            f.date ? `${f.date}: ${f.frequency}` : f.frequency
        ).join('\n') : null;
    }

    toJson() {
    }

    getTooltipFieldList(t) {
        const data: DocumentTooltipField[] = [
            {label: "Id", value: this.id},
            {label: "System number", value: this.sysno},
            {label: "Material type", value: t(this.material_type)},
            {label: "Issuance type", value: t(this.issuance_type)},
            {label: "Year", value: this.year},
            {label: "Volume", value: this.volume},
            {label: "Bundle", value: this.bundle},
            {label: "Category", value: this.category_name},
            {label: "Signature", value: this.signature},
            {label: "Barcode", value: this.barcode},
            {label: "CNB", value: this.cnb},
            {label: "ISBN/ISSN", value: this.isbn_issn},
            {label: "Title", value: this.title},
            {label: "Digitization state", value: t(this.digitization_state)},
            {label: "Pages count", value: this.pages_count},
            {label: "Pages count predicted", value: this.pages_count_predicted},
            {label: "Size", value: this.size},
            {label: "Location URI", value: this.locationUri},
            {label: "Publisher", value: this.publisher},
            {label: "Publishing place", value: this.publishing_place},
            {label: "Publishing year", value: this.publishing_year},
            {label: "Languages", value: this.languages && this.languages.length > 0 ? this.languages.join(', ') : null},
            {label: "Frequencies", value: DocumentModel.formatFrequencies(this.frequencies)},
            {label: "Creator", value: this.creator},
            {label: "Creator department", value: this.department},
            {label: "Created at", value: this.created_at},
            {label: "Extraction id", value: this.extraction_id},
            {label: "Extractor", value: this.extractor},
            {label: "Extracted at", value: this.extracted_at},
        ];
        return data.filter(field => field.value);
    }
}

export default DocumentModel;
