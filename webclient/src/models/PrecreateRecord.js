import { ca } from "date-fns/locale";
import { Issue } from "./Issue";
import { Record } from "./Record";

export class PrecreateRecord {
    record;

    periodicity;
    publishing_date;
    issues;

    identifier_type;
    identifier_value;
    error;

    static fromJson(jsonData) {
        const precreateRecord = new PrecreateRecord();
        console.log(jsonData);

        if (jsonData.record) {
            precreateRecord.record = Record.fromJson(jsonData.record);
            precreateRecord.periodicity = jsonData.record.periodicity;
            precreateRecord.publishing_date = jsonData.record.publishing_date;
            precreateRecord.issues = jsonData.record.issues
                    ? jsonData.record.issues.map(issue => Issue.fromJson(issue))
                    : null;
        }

        precreateRecord.identifier_type = jsonData.identifier.identifier_type;
        precreateRecord.identifier_type = jsonData.identifier.identifier_type;
        precreateRecord.identifier_value = jsonData.identifier.value;
        precreateRecord.error_type = jsonData.error_type;

        return precreateRecord;
    }

    toCreateRecord(category_id, issue) {
        const new_record = Record.fromJson({...this.record});

        new_record.category_id = category_id;
        new_record.volume_number = issue && issue.volume ? issue.volume : null;
        new_record.item_number = issue && issue.item ? issue.item : null;
        if (issue && issue.signature) {
            new_record.signature = issue.signature;
        }
        if (issue && issue.barcode) {
            new_record.barcode = issue.barcode;
        }

        return new_record;
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