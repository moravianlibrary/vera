import React, {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { IdentifierType } from "../../types/IdentifierType";
import { useTranslation } from "react-i18next";
import ApiDocuments, {
    Document,
    DocumentCreationResponse,
    Identifier,
    Issue,
} from "../../adapters/ApiDocuments";
import { DocumentCreateResult } from "../../types/DocumentCreateResult";
import { useToast } from "../toast/ToastContext";
import { FileUploadHandlerEvent } from "primereact/fileupload";
import { generateMessageForResponse } from "../../features/insert-documents/InsertDocumentsFunctions";
import { ActionSeverity } from "../../types/PrimeReactTypes";
import { MaterialType } from "../../types/MaterialType";
import * as XLSX from "xlsx";
import { useCategories } from "../categories/CategoriesContext";

export interface FileUploadValue {
    filename: string;
    value: string;
    identifier: IdentifierType;
    category_id: number | null;
}

export interface SpreadsheetContent {
    sheetName: string;
    formulaeData: string[];
    maxCol: number;
}

export interface SpreadsheetFileContent {
    fileName: string;
    content: SpreadsheetContent[];
}

interface InsertDocumentsContextProps {
    identifier: IdentifierType;
    setIdentifier: (type: IdentifierType) => void;

    category: number | null;
    setCategory: (category: number | null) => void;

    insertAnother: boolean;
    setInsertAnother: (insertAnother: boolean) => void;

    fillMissingDataManually: boolean;
    setFillMissingDataManually: (fillMissingDataManually: boolean) => void;

    value: string;
    setValue: (value: string) => void;
    fileUploadValues: FileUploadValue[];
    spreadsheetFileContent: SpreadsheetFileContent | null;
    handleChooseSpreadsheetValues: (filename: string, values: string[]) => void;
    handleFileUpload: (e: FileUploadHandlerEvent) => void;
    updateFileUploadRow: (index: number, data: FileUploadValue) => void;
    clearFileUploadValues: () => void;

    acceptInput: () => void;
    results: DocumentCreationResponse[];
    chooseIssuesDocuments: DocumentCreationResponse[];
    createIssue: (index: number, issue: Issue) => void;
    creatingIssues: Issue[];
    createdIssues: Issue[];

    withoutPagesCount: Document[];
    handleSetPagesCount: (document: Document, pagesCount: number) => void;
}

interface InsertDocumentsProviderProps {
    children: ReactNode;
}

const InsertDocumentsContext = createContext<
    InsertDocumentsContextProps | undefined
>(undefined);

export const InsertDocumentsProvider: React.FC<
    InsertDocumentsProviderProps
> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { categories } = useCategories();

    // First step variables
    const [identifier, setIdentifier] = useState<IdentifierType>(
        IdentifierType.Sysno
    );
    const [category, setCategory] = useState<number | null>(null);
    const [insertAnother, setInsertAnother] = useState<boolean>(false);
    const [fillMissingDataManually, setFillMissingDataManually] =
        useState<boolean>(true);

    // Second step variables
    const [value, setValue] = useState<string>("");
    const [spreadsheetFileContent, setSpreadsheetFileContent] =
        useState<SpreadsheetFileContent | null>(null);
    const [fileUploadValues, setFileUploadValues] = useState<FileUploadValue[]>(
        []
    );
    const [results, setResults] = useState<DocumentCreationResponse[]>([]);
    const [chooseIssuesDocuments, setChooseIssuesDocuments] = useState<
        DocumentCreationResponse[]
    >([]);

    // Third step variables
    const [creatingIssues, setCreatingIssues] = useState<Issue[]>([]);
    const [createdIssues, setCreatedIssues] = useState<Issue[]>([]);

    // Fourth step variables
    const [withoutPagesCount, setWithoutPagesCount] = useState<Document[]>([]);

    // Second step functions
    const handleSetValue = (value: string) => {
        setValue(value);
    };

    const handleTextFileUpload = (file: File) => {
        const fileReader = new FileReader();
        fileReader.onload = (e) => {
            if (e.target) {
                (e.target.result as string)
                    .split("\n")
                    .filter((line) => line.length > 0)
                    .forEach((value) => {
                        setFileUploadValues((prevFileUploadValues) => [
                            ...prevFileUploadValues,
                            {
                                filename: file.name,
                                value: value,
                                identifier: identifier,
                                category_id: category,
                            },
                        ]);
                    });
            }
        };
        fileReader.readAsText(file);
    };

    function colStringToIndex(colString: string) {
        let index = 0;
        for (let i = 0; i < colString.length; i++) {
            index *= 26;
            index += colString.charCodeAt(i) - "A".charCodeAt(0) + 1;
        }
        return index;
    }

    const handleExcelFileUpload = (file: File) => {
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

                setSpreadsheetFileContent({
                    fileName: file.name,
                    content: sheets,
                });
            }
        };
        fileReader.readAsArrayBuffer(file);
    };

    const handleFileUpload = (e: FileUploadHandlerEvent) => {
        e.files.forEach((file) => {
            if (file.type === "text/plain") {
                handleTextFileUpload(file);
            } else if (
                file.type ===
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ) {
                handleExcelFileUpload(file);
            } else {
                showToast("error", t("File type not supported"));
            }
        });
    };

    const handleChooseSpreadsheetValues = (
        filename: string,
        values: string[]
    ) => {
        const correctSysno = (value: string) => {
            if (identifier !== IdentifierType.Sysno) {
                return value;
            }
            return value.padStart(9, "0");
        };

        setFileUploadValues((prevFileUploadValues) => [
            ...prevFileUploadValues,
            ...values
                .map((value) => value.split(/\r?\n/))
                .flat()
                .map((value) => ({
                    filename: filename,
                    value: correctSysno(value.trim()),
                    identifier: identifier,
                    category_id: category,
                })),
        ]);
    };

    const updateFileUploadRow = (index: number, data: FileUploadValue) => {
        setFileUploadValues((prevFileUploadValues) =>
            prevFileUploadValues.map((row, i) => (i === index ? data : row))
        );
    };

    const clearFileUploadValues = () => {
        setFileUploadValues([]);
        setSpreadsheetFileContent(null);
    };

    const addToWithoutPagesCount = (document: Document) => {
        const isPredictable = (document: Document) => {
            return (
                document.material_type === MaterialType.ContinuingResource &&
                document.frequencies &&
                document.frequencies.length > 0 &&
                document.publisher &&
                document.publishing_place &&
                document.year
            );
        };
        if (document.pages_count_catalog === null && !isPredictable(document)) {
            setWithoutPagesCount((prev) => [...prev, document]);
        }
    };

    const processCreateResponses = (
        identifier: Identifier,
        response: DocumentCreationResponse
    ) => {
        if (response.create_result === DocumentCreateResult.MultipleIssues) {
            setChooseIssuesDocuments((prev) => [...prev, response]);
        } else {
            setResults((prev) => [...prev, response]);
            if (response.create_result === DocumentCreateResult.Success) {
                addToWithoutPagesCount(response.document!);
            }
        }
    };

    const createFromValue = async () => {
        const inputIdentifier: Identifier = {
            identifier_type: identifier,
            value: value,
        };
        ApiDocuments.insertDocument(inputIdentifier, category, false)
            .then((response) =>
                processCreateResponses(inputIdentifier, response.data)
            )
            .catch((error) => {
                console.error(`Error while inserting document: ${error}`);
            });
    };

    const createFromFiles = async () => {
        for (const fileUploadValue of fileUploadValues) {
            const inputIdentifier: Identifier = {
                identifier_type: fileUploadValue.identifier,
                value: fileUploadValue.value,
            };

            await ApiDocuments.insertDocument(inputIdentifier, category, false)
                .then((response) =>
                    processCreateResponses(inputIdentifier, response.data)
                )
                .catch((error) => {
                    console.error(`Error while inserting document: ${error}`);
                });
        }
    };

    const acceptInput = async () => {
        setChooseIssuesDocuments([]);
        setResults([]);
        setWithoutPagesCount([]);
        if (value !== "") {
            await createFromValue();
        }
        if (fileUploadValues.length > 0) {
            await createFromFiles();
        }
    };

    // Third step functions
    const createIssue = async (index: number, issue: Issue) => {
        setCreatingIssues((prevCreatingIssues) => [
            ...prevCreatingIssues,
            issue,
        ]);

        ApiDocuments.insertDocument(
            { identifier_type: IdentifierType.Barcode, value: issue.barcode },
            category,
            false
        )
            .then((response) => {
                if (
                    response.data.create_result !== DocumentCreateResult.Success
                ) {
                    console.error(
                        "Could not create given issue. This code should be unreachable."
                    );
                }
                setCreatingIssues((prevCreatingIssues) =>
                    prevCreatingIssues.filter(
                        (i) => i.barcode !== issue.barcode
                    )
                );
                setCreatedIssues((prevCreatedIssues) => [
                    ...prevCreatedIssues,
                    issue,
                ]);
                setResults((prev) => [...prev, response.data]);
                addToWithoutPagesCount(response.data.document!);
                const messageProps = generateMessageForResponse(response.data);
                showToast(
                    messageProps.severity as ActionSeverity,
                    t(messageProps.summary),
                    t(messageProps.detail)
                );
            })
            .catch((error) => {
                console.error(`Error while inserting document: ${error}`);
            });
    };

    // Fourth step functions
    const handleSetPagesCount = (document: Document, pagesCount: number) => {
        const updateDocument = {
            ...document,
            pages_count_manual: pagesCount,
        };
        ApiDocuments.updateDocument(updateDocument)
            .then((response) => {
                if (response.data.pages_count_manual === pagesCount) {
                    showToast("success", t("Pages count updated"), "");
                    setWithoutPagesCount((prev) =>
                        prev.filter((d) => d.id !== document.id)
                    );
                } else {
                    showToast("error", t("Pages count update failed"), "");
                }
            })
            .catch((error) => {
                showToast(
                    "error",
                    t("Pages count update failed"),
                    error.message
                );
            });
    };

    return (
        <InsertDocumentsContext.Provider
            value={{
                identifier,
                setIdentifier,

                category,
                setCategory,

                insertAnother,
                setInsertAnother,

                fillMissingDataManually,
                setFillMissingDataManually,

                value,
                setValue: handleSetValue,
                fileUploadValues,
                spreadsheetFileContent,
                handleChooseSpreadsheetValues,
                handleFileUpload,
                updateFileUploadRow,
                clearFileUploadValues,

                acceptInput,
                results,
                chooseIssuesDocuments,
                createIssue,
                creatingIssues,
                createdIssues,

                withoutPagesCount,
                handleSetPagesCount,
            }}
        >
            {children}
        </InsertDocumentsContext.Provider>
    );
};

export const useInsertDocuments = () => {
    const context = useContext(InsertDocumentsContext);
    if (!context) {
        throw new Error(
            "useInsertDocuments must be used within a InsertDocumentsProvider"
        );
    }
    return context;
};
