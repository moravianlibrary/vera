import { ca } from "date-fns/locale";
import { Issue } from "./Issue";
import { Document } from "./Document";

export class PrecreateDocument {
    document;

    periodicity;
    publishing_date;
    issues;

    identifier_type;
    identifier_value;
    error;

    static fromJson(jsonData) {
        const precreateDocument = new PrecreateDocument();
        console.log(jsonData);

        if (jsonData.document) {
            precreateDocument.document = Document.fromJson(jsonData.document);
            precreateDocument.periodicity = jsonData.document.periodicity;
            precreateDocument.publishing_date = jsonData.document.publishing_date;
            precreateDocument.issues = jsonData.document.issues
                    ? jsonData.document.issues.map(issue => Issue.fromJson(issue))
                    : null;
        }

        precreateDocument.identifier_type = jsonData.identifier.identifier_type;
        precreateDocument.identifier_type = jsonData.identifier.identifier_type;
        precreateDocument.identifier_value = jsonData.identifier.value;
        precreateDocument.error_type = jsonData.error_type;

        return precreateDocument;
    }

    toCreateDocument(category_id, issue) {
        const new_document = Document.fromJson({...this.document});

        new_document.category_id = category_id;
        new_document.volume_number = issue && issue.volume ? issue.volume : null;
        new_document.item_number = issue && issue.item ? issue.item : null;
        if (issue && issue.signature) {
            new_document.signature = issue.signature;
        }
        if (issue && issue.barcode) {
            new_document.barcode = issue.barcode;
        }

        return new_document;
    }

    static decodeBarcode(inputString) {
        const decodingMap = {
            '!': '1',
            '@': '2',
            '#': '3',
            '$': '4',
            '%': '5',
            '^': '6',
            '&': '7',
            '*': '8',
            '(': '9',
            ')': '0',
        };

        const decodedArray = inputString.split('').map(char => decodingMap[char] || char);
        console.log(decodedArray);

        return decodedArray.join('');
    }
}