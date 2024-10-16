import React, {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { IdentifierType } from "../../types/IdentifierType";
import { useTranslation } from "react-i18next";
import ApiDocuments, {
    AddDocumentResponse,
    CatalogDocumentResponse,
    CatalogIssueResponse,
    Identifier,
} from "../../adapters/ApiDocuments";
import { useToast } from "../ToastContext";
import { FileUploadHandlerEvent } from "primereact/fileupload";
import * as XLSX from "xlsx";
import AddDocumentResponseStatus from "../../types/AddDocumentResponseStatus";
import useIssuesSelection, {
    SelectIssuesInjectorProps,
} from "./SelectIssuesInjector";
import useObjectiveSettings, {
    ObjectiveSettingsInjectorProps,
} from "../base/ObjectiveSettingsInjector";
import useAddDocuments, {
    AddDocumentsInjectorProps,
} from "./AddDocumentsInjector";
import { set } from "date-fns";

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

interface InsertDocumentsContextProps
    extends ObjectiveSettingsInjectorProps<AddDocumentsSettings>,
        AddDocumentsInjectorProps,
        SelectIssuesInjectorProps {
    currStep: number;
    goToNextStep: () => void;
    goToPrevStep: () => void;
    // TODO: create specialized form for setting value
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
    const showToast = useToast();
    const api = new ApiDocuments();

    const { settings, ...restOfObjectiveSettingsProps } =
        useObjectiveSettings<AddDocumentsSettings>(
            SETTINGS_NAME,
            DEFAULT_SETTINGS
        );
    const {
        processedCount,
        totalCount,
        multipleIssuesDocuments,
        addDocument,
        addDocuments,
        resetResponses,
        ...restOfAddDocumentsProps
    } = useAddDocuments(api, settings);
    const {
        totalCountIssuesDocuments,
        currIndex,
        goToNextDocument,
        goToPrevDocument,
        ...restOfIssuesSelectionProps
    } = useIssuesSelection(
        useMemo(
            () => Object.values(multipleIssuesDocuments),
            [multipleIssuesDocuments]
        ),
        addDocument
    );

    const [value, setValue] = useState<string>("");
    const [spreadsheetFileContent, setSpreadsheetFileContent] =
        useState<SpreadsheetFileContent | null>(null);
    const [fileUploadValues, setFileUploadValues] = useState<FileUploadValue[]>(
        []
    );

    const resetValues = () => {
        setValue("");
        setFileUploadValues([]);
        setSpreadsheetFileContent(null);
    };

    const [currStep, setCurrStep] = useState<number>(0);

    const onAddDocument = useCallback(async () => {
        try {
            await addDocument({
                identifier_type: settings.identifierType,
                value: value,
            });

            setCurrStep(
                Object.keys(multipleIssuesDocuments).length > 0 ? 2 : 3
            );
        } catch (error) {
            console.error("Error adding document:", error);
        }
    }, [settings.identifierType, multipleIssuesDocuments, value, addDocument]);

    const onAddDocuments = useCallback(async () => {
        try {
            await addDocuments(
                fileUploadValues.map((value) => ({
                    identifier_type: value.identifier,
                    value: value.value,
                    categoryId: value.category_id!,
                    extractionPriority: settings.extractionPriority,
                }))
            );

            setCurrStep(totalCountIssuesDocuments > 0 ? 2 : 3);
        } catch (error) {
            console.error("Error adding documents:", error);
        }
    }, [
        fileUploadValues,
        settings.extractionPriority,
        totalCountIssuesDocuments,
    ]);

    useEffect(() => {
        if (totalCount > 0 && processedCount === totalCount) {
            setCurrStep(
                Object.keys(multipleIssuesDocuments).length > 0 ? 2 : 3
            );
        }
    }, [processedCount, totalCount, multipleIssuesDocuments]);

    const goToNextStep = useCallback(() => {
        switch (currStep) {
            case 0:
                setCurrStep(1);
                break;
            case 1:
                if (value !== "") {
                    onAddDocument();
                } else if (fileUploadValues.length > 0) {
                    onAddDocuments();
                }
                break;
            case 2:
                if (currIndex < totalCountIssuesDocuments - 1) {
                    goToNextDocument();
                } else {
                    setCurrStep(3);
                }
                break;
            default:
                break;
        }
    }, [currStep, value, fileUploadValues]);

    const goToPrevStep = useCallback(() => {
        switch (currStep) {
            case 1:
                setCurrStep(0);
                break;
            case 2:
                if (currIndex > 0) {
                    goToPrevDocument();
                }
                break;
            case 3:
                resetResponses();
                resetValues();
                setCurrStep(1);
            default:
                break;
        }
    }, [currStep]);

    // First step variables
    // Second step variables
    // Responses

    // Third step variables

    // Fourth step variables
    const [withoutPageCount, setWithoutPageCount] = useState<number[]>([]);

    // First step functions

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
        setFileUploadValues((prevFileUploadValues) => [
            ...prevFileUploadValues,
            ...values
                .map((value) => value.split(/\r?\n/))
                .flat()
                .map((value) => ({
                    filename: filename,
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

    const acceptInput = async () => {
        if (value !== "") {
            addDocument({
                identifier_type: settings.identifierType,
                value: value,
            });
        } else if (fileUploadValues) {
            addDocuments(
                fileUploadValues.map((value) => ({
                    identifier_type: value.identifier,
                    value: value.value,
                    categoryId: value.category_id!,
                    extractionPriority: settings.extractionPriority,
                }))
            );
        }
    };

    const resetInputs = () => {
        setValue("");
        setFileUploadValues([]);
        setSpreadsheetFileContent(null);
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

    const resetResults = useCallback(() => {
        resetResponses();
        setWithoutPageCount([]);
    }, []);

    return (
        <InsertDocumentsContext.Provider
            value={{
                currStep,
                goToNextStep,
                goToPrevStep,

                settings,
                ...restOfObjectiveSettingsProps,

                value,
                setValue: handleSetValue,
                fileUploadValues,
                spreadsheetFileContent,
                handleChooseSpreadsheetValues,
                handleFileUpload,
                updateFileUploadRow,
                clearFileUploadValues,

                processedCount,
                totalCount,
                multipleIssuesDocuments,
                addDocument,
                addDocuments,
                resetResponses,
                ...restOfAddDocumentsProps,

                totalCountIssuesDocuments,
                currIndex,
                goToNextDocument,
                goToPrevDocument,
                ...restOfIssuesSelectionProps,

                acceptInput,
                resetInputs,

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
