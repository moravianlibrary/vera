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
    AddDocumentResponse,
    CatalogIssueResponse,
    Identifier,
} from "../../adapters/ApiDocuments";
import { useToast } from "../ToastContext";
import { FileUploadHandlerEvent } from "primereact/fileupload";
import { generateMessageForResponse } from "../../features/insert-documents/InsertDocumentsFunctions";
import { ActionSeverity } from "../../types/PrimeReactTypes";
import * as XLSX from "xlsx";
import AddDocumentResponseStatus from "../../types/AddDocumentResponseStatus";
import { useAccess } from "../AccessContext";

export interface AddDocumentsSettings {
    identifierType: IdentifierType;
    categoryId: number | null;
    insertAnother: boolean;
    extractionPriority: number;
}

const SETTINGS_NAME = "addDocumentSettings";

const DEFAULT_SETTINGS: AddDocumentsSettings = {
    identifierType: IdentifierType.Sysno,
    categoryId: null,
    insertAnother: true,
    extractionPriority: 3,
};

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

export type AddDocumentResponses = Record<
    AddDocumentResponseStatus,
    AddDocumentResponse[]
>;

const generateEmptyResponses = (): AddDocumentResponses => {
    return Object.values(AddDocumentResponseStatus).reduce((acc, status) => {
        acc[status as AddDocumentResponseStatus] = [];
        return acc;
    }, {} as AddDocumentResponses);
};

interface InsertDocumentsContextProps {
    settings: AddDocumentsSettings;
    onAcceptSettings: (settings: AddDocumentsSettings) => void;

    value: string;
    setValue: (value: string) => void;
    // TODO: create specialized form for uploading values from files
    fileUploadValues: FileUploadValue[];
    spreadsheetFileContent: SpreadsheetFileContent | null;
    handleChooseSpreadsheetValues: (filename: string, values: string[]) => void;
    handleFileUpload: (e: FileUploadHandlerEvent) => void;
    updateFileUploadRow: (index: number, data: FileUploadValue) => void;
    clearFileUploadValues: () => void;

    acceptInput: () => void;
    resetInputs: () => void;
    processedCount: number;
    responses: AddDocumentResponses;
    createIssue: (index: number, issue: CatalogIssueResponse) => void;
    creatingIssues: CatalogIssueResponse[];
    resetResults: () => void;

    withoutPageCount: number[];
    handleSetPagesCount: (
        issue: CatalogIssueResponse,
        pagesCount: number
    ) => void;
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
    const { currentUser, getSettings, updateSettings } = useAccess();
    const showToast = useToast();
    const api = new ApiDocuments();

    // First step variables
    const [settings, setSettings] = useState<AddDocumentsSettings>(
        (getSettings(SETTINGS_NAME) as AddDocumentsSettings) || DEFAULT_SETTINGS
    );

    // Second step variables
    const [value, setValue] = useState<string>("");
    const [spreadsheetFileContent, setSpreadsheetFileContent] =
        useState<SpreadsheetFileContent | null>(null);
    const [fileUploadValues, setFileUploadValues] = useState<FileUploadValue[]>(
        []
    );
    // Responses
    const [processedCount, setProcessedCount] = useState<number>(0);
    const [responses, setResponses] = useState<AddDocumentResponses>(
        generateEmptyResponses()
    );

    // Third step variables
    const [creatingIssues, setCreatingIssues] = useState<
        CatalogIssueResponse[]
    >([]);

    // Fourth step variables
    const [withoutPageCount, setWithoutPageCount] = useState<number[]>([]);

    // First step functions
    const onAcceptSettings = (settings: AddDocumentsSettings) => {
        updateSettings(SETTINGS_NAME, settings);
        setSettings(settings);
    };

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
                                identifier: settings.identifierType,
                                category_id: settings.categoryId,
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
            if (settings.identifierType !== IdentifierType.Sysno) {
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
                    // value: correctSysno(value.trim()),
                    value: value.trim(),
                    identifier: settings.identifierType,
                    category_id: settings.categoryId,
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

    const onInsertDocument = async (identifier: Identifier) => {
        try {
            const response = await api.insertDocument(
                identifier,
                settings.categoryId,
                false
            );
            setProcessedCount((prev) => prev + 1);
            return response;
        } catch (error) {
            console.error("Error inserting document:", error);
            return null;
        }
    };

    const acceptInput = async () => {
        try {
            const newResponses = (
                await Promise.all(
                    value !== ""
                        ? [
                              await onInsertDocument({
                                  identifier_type: settings.identifierType,
                                  value: value,
                              }),
                          ]
                        : fileUploadValues.map((fileUploadValue) =>
                              onInsertDocument({
                                  identifier_type: fileUploadValue.identifier,
                                  value: fileUploadValue.value,
                              })
                          )
                )
            )
                .filter((response) => response)
                .map((response) => response!.data)
                .reduce<AddDocumentResponses>((acc, response) => {
                    acc[response.status].push(response);
                    return acc;
                }, generateEmptyResponses());

            setWithoutPageCount(
                newResponses.Success.map((r, index) =>
                    !r.document?.issues?.[0]?.page_count ? index : -1
                ).filter((index) => index >= 0)
            );
            setResponses(newResponses);
        } catch (error) {
            console.error(`Error while accepting input: ${error}`);
        }
    };

    const resetInputs = () => {
        setValue("");
        setFileUploadValues([]);
        setSpreadsheetFileContent(null);
        setProcessedCount(0);
    };

    // Third step functions
    const createIssue = async (index: number, issue: CatalogIssueResponse) => {
        setCreatingIssues((prevCreatingIssues) => [
            ...prevCreatingIssues,
            issue,
        ]);

        api.insertDocument(
            { identifier_type: IdentifierType.Barcode, value: issue.barcode! },
            settings.categoryId,
            false
        )
            .then((response) => {
                if (
                    response.data.status !== AddDocumentResponseStatus.Success
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
    const handleSetPagesCount = (
        issue: CatalogIssueResponse,
        pagesCount: number
    ) => {
        const updateDocument = {
            ...document,
            pages_count_manual: pagesCount,
        };
        const documentId = issue.document_id!;
        api.update(documentId, updateDocument)
            .then((response) => {
                if (response.data.pages_count_manual === pagesCount) {
                    showToast("success", t("Pages count updated"), "");
                    setWithoutPageCount((prev) =>
                        prev.filter((d) => d[1].document_id !== documentId)
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

    const resetResults = () => {
        setResponses(generateEmptyResponses());
        setWithoutPageCount([]);
        setCreatingIssues([]);
    };

    return (
        <InsertDocumentsContext.Provider
            value={{
                settings,
                onAcceptSettings,

                value,
                setValue: handleSetValue,
                fileUploadValues,
                spreadsheetFileContent,
                handleChooseSpreadsheetValues,
                handleFileUpload,
                updateFileUploadRow,
                clearFileUploadValues,

                acceptInput,
                resetInputs,
                processedCount,
                responses,
                createIssue,
                creatingIssues,

                withoutPageCount,
                handleSetPagesCount,
                resetResults,
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
