import { format } from 'date-fns';

export class Record {
    id;

    sysno;
    volume_number;
    item_number;
    material_type;
    publishers;

    category;
    title;
    pages_count;
    size;

    signature;
    issn;
    isbn;
    barcode;

    creator_id;
    creator_department_id;
    creator;
    created_at;

    extraction_id;
    extractor_id;
    extractor;
    extracted_at;

    comments_count;

    constructor() {
    }

    static fromJson(jsonData) {
        const record = new Record();

        record.id = jsonData.id;
        record.sysno = jsonData.sysno;
        record.volume_number = jsonData.volume_number ? decodeURIComponent(jsonData.volume_number) : null;
        record.item_number = jsonData.item_number ? decodeURIComponent(jsonData.item_number) : null;
        record.material_type = jsonData.material_type;
        record.publishers = jsonData.publishers;
        record.size = jsonData.size;
        record.category_id = jsonData.category_id ? parseInt(jsonData.category_id) : null;
        record.category_name = jsonData.category_name ? decodeURIComponent(jsonData.category_name) : null;
        record.title = jsonData.title ? decodeURIComponent(jsonData.title) : null;
        record.pages_count = jsonData.pages_count ? parseInt(jsonData.pages_count) : null;
        record.signature = jsonData.signature ? decodeURIComponent(jsonData.signature) : null;
        record.ccnb = jsonData.ccnb;
        record.isbn = jsonData.isbn;
        record.barcode = jsonData.barcode;
        record.creator_id = jsonData.creator_id;
        record.creator_department_id = jsonData.creator_department_id;
        record.creator = jsonData.creator ? decodeURIComponent(jsonData.creator) : null;
        record.created_at = jsonData.created_at;
        record.extraction_id = jsonData.extraction_id;
        record.extractor_id = jsonData.extractor_id;
        record.extractor = jsonData.extractor ? decodeURIComponent(jsonData.extractor) : null;
        record.extracted_at = jsonData.extracted_at;
        record.comments_count = jsonData.comments_count;

        return record;
    }

    toJson() {
        // TODO: check for empty strings
        return {
            sysno: this.sysno,
            volume_number: this.volume_number ? encodeURIComponent(this.volume_number) : null,
            item_number: this.item_number ? encodeURIComponent(this.item_number) : null,
            material_type: this.material_type,
            title: this.title ? encodeURIComponent(this.title) : null,
            publishers: this.publishers,
            pages_count: this.pages_count,
            size: this.size,
            signature: this.signature ? encodeURIComponent(this.signature) : null,
            barcode: this.barcode,
            ccnb: this.ccnb,
            isbn: this.isbn,
            category_id: this.category_id,
        };
    }

    getCreatedAtFormatted() {
        return this.created_at ? format(new Date(this.created_at), 'dd.MM.yyyy HH:mm:ss') : null;
    }

    getExtractedAtFormatted() {
        return this.extracted_at ? format(new Date(this.extracted_at), 'dd.MM.yyyy HH:mm:ss') : null;
    }
}