import * as XLSX from "xlsx";
import { IdentifierType } from "../../../types/IdentifierType";
import { IdentifierWithAttributes } from "../../../adapters/ApiDocuments";

export interface SpreadsheetContent {
    sheetName: string;
    formulaeData: string[];
    maxCol: number;
}

export interface SpreadsheetFileContent {
    fileName: string;
    content: SpreadsheetContent[];
}

const parseTextFileUpload = (
    file: File,
    identifier_type: IdentifierType,
    category_id: number,
    extraction_priority: number
) => {
    return new Promise<IdentifierWithAttributes[]>((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = (e) => {
            if (e.target) {
                const values = (e.target.result as string)
                    .replace(/\r\n/g, "\n")
                    .split("\n")
                    .filter((line) => line.length > 0)
                    .map((value) => ({
                        identifier_type: identifier_type,
                        value,
                        category_id,
                        extraction_priority,
                    }));

                resolve(values);
            } else {
                reject("File could not be read.");
            }
        };

        fileReader.onerror = () => reject("Error reading file.");
        fileReader.readAsText(file);
    });
};

function colStringToIndex(colString: string) {
    let index = 0;
    for (let i = 0; i < colString.length; i++) {
        index *= 26;
        index += colString.charCodeAt(i) - "A".charCodeAt(0) + 1;
    }
    return index;
}

function parseExcelFileUpload(file: File) {
    return new Promise<SpreadsheetContent[]>((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = (e) => {
            if (e.target) {
                const data = new Uint8Array(e.target.result as ArrayBufferLike);
                const workbook = XLSX.read(data, { type: "array" });

                let sheets: SpreadsheetContent[] = [];

                workbook.SheetNames.forEach((sheetName) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const formulaeData =
                        XLSX.utils.sheet_to_formulae(worksheet);

                    if (formulaeData.length === 0) {
                        return;
                    }

                    const maxCol = formulaeData.reduce(
                        (furthestCol, current) => {
                            const currentCol = colStringToIndex(
                                current.match(/[A-Z]+/)![0]
                            );
                            return furthestCol > currentCol
                                ? furthestCol
                                : currentCol;
                        },
                        0
                    );

                    sheets.push({
                        sheetName: sheetName,
                        formulaeData: formulaeData,
                        maxCol: maxCol,
                    });
                });

                resolve(sheets);
            } else {
                reject("File could not be read.");
            }
        };

        fileReader.onerror = () => reject("Error reading file.");
        fileReader.readAsArrayBuffer(file);
    });
}

export { parseTextFileUpload, parseExcelFileUpload };
