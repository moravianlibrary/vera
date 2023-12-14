import { format } from 'date-fns';

export class Document {
    id;

    sysno;
    volume_number;
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
        const document = new Document();

        document.id = jsonData.id;
        document.sysno = jsonData.sysno;
        document.volume_number = jsonData.volume_number ? decodeURIComponent(jsonData.volume_number) : null;
        document.material_type = jsonData.material_type;
        document.publishers = jsonData.publishers;
        document.size = jsonData.size;
        document.category_id = jsonData.category_id ? parseInt(jsonData.category_id) : null;
        document.category_name = jsonData.category_name ? decodeURIComponent(jsonData.category_name) : null;
        document.title = jsonData.title ? decodeURIComponent(jsonData.title) : null;
        document.pages_count = jsonData.pages_count ? parseInt(jsonData.pages_count) : null;
        document.signature = jsonData.signature ? decodeURIComponent(jsonData.signature) : null;
        document.ccnb = jsonData.ccnb;
        document.isbn = jsonData.isbn;
        document.barcode = jsonData.barcode;
        document.creator_id = jsonData.creator_id;
        document.creator_department_id = jsonData.creator_department_id;
        document.creator = jsonData.creator ? decodeURIComponent(jsonData.creator) : null;
        document.created_at = jsonData.created_at;
        document.extraction_id = jsonData.extraction_id;
        document.extractor_id = jsonData.extractor_id;
        document.extractor = jsonData.extractor ? decodeURIComponent(jsonData.extractor) : null;
        document.extracted_at = jsonData.extracted_at;
        document.comments_count = jsonData.comments_count;

        return document;
    }

    toJson() {
        // TODO: check for empty strings
        return {
            sysno: this.sysno,
            volume_number: this.volume_number ? encodeURIComponent(this.volume_number) : null,
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