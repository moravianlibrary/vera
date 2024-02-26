const BASE_URL = 'https://registrdigitalizace.cz/rdcz/';
const QUERY = 'results;q={BARCODE}';

export class DigitizationRegistry {
    static getDocumentLink(barcode: string) {
        return BASE_URL + QUERY.replace('{BARCODE}', barcode);
    }
}