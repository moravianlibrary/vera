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

    constructor() {
        // this.id = 0;
        this.sysno = '';
        // this.volume_number = '';
        // this.item_number = '';
        // this.category = '';
        // this.title = '';
        // this.pages_count = 0;
        // this.signature = '';
        // this.issn = '';
        // this.isbn = '';
        // this.barcode = '';
    }

    fromJson(jsonData) {
        this.id = jsonData.id || 0;
        this.sysno = jsonData.sysno || '';
        this.volume_number = jsonData.volume_number || '';
        this.item_number = jsonData.item_number || '';
        this.category = jsonData.category || '';
        this.title = jsonData.title || '';
        this.pages_count = jsonData.pages_count || 0;
        this.signature = jsonData.signature || '';
        this.issn = jsonData.issn || '';
        this.isbn = jsonData.isbn || '';
        this.barcode = jsonData.barcode || '';
    }

    toJson() {
        return {
        id: this.id,
        sysno: this.sysno,
        volume_number: this.volume_number,
        item_number: this.item_number,
        category: this.category,
        title: this.title,
        pages_count: this.pages_count,
        signature: this.signature,
        issn: this.issn,
        isbn: this.isbn,
        barcode: this.barcode,
        };
    }

    getId() {
        return this.id;
    }

    getSysno() {
        return this.sysno;
    }
    setSysno(sysno) {
        this.sysno = sysno;
    }

    getVolumeNumber() {
        return this.volume_number;
    }
    setVolumeNumber(volume_number) {
        this.volume_number = volume_number;
    }

    getItemNumber() {
        return this.item_number;
    }
    setItemNumber(item_number) {
        this.item_number = item_number;
    }

    getCategory() {
        return this.category;
    }
    setCategory(category) {
        this.category = category;
    }

    getTitle() {
        return this.title;
    }
    setTitle(title) {
        this.title = title;
    }

    getPagesCount() {
        return this.pages_count;
    }
    setPagesCount(pages_count) {
        this.pages_count = pages_count;
    }

    getSignature() {
        return this.signature;
    }
    setSignature(signature) {
        this.signature = signature;
    }

    getIssn() {
        return this.issn;
    }
    setIssn(issn) {
        this.issn = issn;
    }

    getIsbn() {
        return this.isbn;
    }
    setIsbn(isbn) {
        this.isbn = isbn;
    }

    getBarcode() {
        return this.barcode;
    }
    setBarcode(barcode) {
        this.barcode = barcode;
    }
}