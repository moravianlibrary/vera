import { format } from 'date-fns';

export class Record {
    id;

    sysno;
    volume_number;
    item_number;

    category;
    title;
    pages_count;

    signature;
    issn;
    isbn;
    barcode;

    creator_id;
    creator;
    created_at;

    extraction_id;
    extractor_id;
    extractor;
    extracted_at;

    comments_count;

    constructor() {
        this.sysno = null;
    }

    static fromJson(jsonData) {
        const record = new Record();

        record.id = jsonData.id;
        record.sysno = jsonData.sysno;
        record.volume_number = jsonData.volume_number ? decodeURIComponent(jsonData.volume_number) : null;
        record.item_number = jsonData.item_number ? decodeURIComponent(jsonData.item_number) : null;
        record.category = jsonData.category ? decodeURIComponent(jsonData.category) : null;
        record.title = jsonData.title ? decodeURIComponent(jsonData.title) : null;
        record.pages_count = jsonData.pages_count;
        record.signature = jsonData.signature ? decodeURIComponent(jsonData.signature) : null;
        record.issn = jsonData.issn;
        record.isbn = jsonData.isbn;
        record.barcode = jsonData.barcode;
        record.creator_id = jsonData.creator_id;
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
        return {
            id: this.id,
            sysno: this.sysno,
            volume_number: encodeURIComponent(this.volume_number),
            item_number: encodeURIComponent(this.item_number),
            category: encodeURIComponent(this.category),
            title: encodeURIComponent(this.title),
            pages_count: this.pages_count,
            signature: encodeURIComponent(this.signature),
            issn: this.issn,
            isbn: this.isbn,
            barcode: this.barcode,
        };
    }

    getCreatedAtFormatted() {
        return format(new Date(this.created_at), 'dd.MM.yyyy HH:mm:ss');
    }

    getExtractedAtFormatted() {
        return this.extracted_at ? format(new Date(this.extracted_at), 'dd.MM.yyyy HH:mm:ss') : null;
    }
}