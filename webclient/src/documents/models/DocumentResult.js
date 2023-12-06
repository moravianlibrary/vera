import { Document } from "./Document";

export class DocumentResult {
    catalog_document;
    create_result;
    digitization_state;
    document;
    identifier;

    static fromJson(json) {
        const result = new DocumentResult();

        result.catalog_document = json.catalog_document;
        result.create_result = json.create_result;
        result.digitization_state = json.digitization_state;
        result.document = json.document ? Document.fromJson(json.document) : null;
        result.identifier = json.identifier;

        return result;
    }
};