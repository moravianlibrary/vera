import React, {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { IdentifierType } from "../../types/IdentifierType";
import { useTranslation } from "react-i18next";
import { useAssignableCategories } from "../categories/AssignableCategoriesContext";
import ApiDocuments, {
    DocumentCreationResponse,
    Identifier,
    Issue,
} from "../../adapters/ApiDocuments";
import { DocumentCreateResult } from "../../types/DocumentCreateResult";
import { AssignableCategory } from "../../adapters/ApiCategories";
import { useToast } from "../toast/ToastContext";
import { FileUploadHandlerEvent } from "primereact/fileupload";
import { generateMessageForResponse } from "../../features/insert-documents/InsertDocumentsFunctions";
import { ActionSeverity } from "../../types/PrimeReactTypes";

export interface FileUploadValue {
    filename: string;
    value: string;
    identifier: IdentifierType;
    category_id: number | null;
}

interface InsertDocumentsContextProps {
    identifier: IdentifierType;
    setIdentifier: (type: IdentifierType) => void;

    categories: AssignableCategory[];
    category: number | null;
    setCategory: (category: number | null) => void;

    insertAnother: boolean;
    setInsertAnother: (insertAnother: boolean) => void;

    value: string;
    setValue: (value: string) => void;
    fileUploadValues: FileUploadValue[];
    handleFileUpload: (e: FileUploadHandlerEvent) => void;
    updateFileUploadRow: (index: number, data: FileUploadValue) => void;
    clearFileUploadValues: () => void;

    acceptInput: () => void;
    results: DocumentCreationResponse[];
    chooseIssuesDocuments: DocumentCreationResponse[];
    createIssue: (index: number, issue: Issue) => void;
    creatingIssues: Issue[];
    createdIssues: Issue[];
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
    const { categories } = useAssignableCategories();

    // First step variables
    const [identifier, setIdentifier] = useState<IdentifierType>(
        IdentifierType.Sysno
    );
    const [category, setCategory] = useState<number | null>(null);
    const [insertAnother, setInsertAnother] = useState<boolean>(false);

    // Second step variables
    const [value, setValue] = useState<string>("");
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

    // Second step functions
    const handleSetValue = (value: string) => {
        setValue(value);
    };

    const handleFileUpload = (e: FileUploadHandlerEvent) => {
        e.files.forEach((file) => {
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
        });
    };

    const updateFileUploadRow = (index: number, data: FileUploadValue) => {
        setFileUploadValues((prevFileUploadValues) =>
            prevFileUploadValues.map((row, i) => (i === index ? data : row))
        );
    };

    const clearFileUploadValues = () => {
        setFileUploadValues([]);
    };

    const processCreateResponses = (response: DocumentCreationResponse) => {
        if (response.create_result === DocumentCreateResult.MultipleIssues) {
            setChooseIssuesDocuments((prev) => [...prev, response]);
        } else {
            setResults((prev) => [...prev, response]);
        }
    };

    const createFromValue = async () => {
        const inputIdentifier: Identifier = {
            identifier_type: identifier,
            value: value,
        };
        ApiDocuments.insertDocument(inputIdentifier, category, false)
            .then((response) => processCreateResponses(response.data))
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
                .then((response) => processCreateResponses(response.data))
                .catch((error) => {
                    console.error(`Error while inserting document: ${error}`);
                });
        }
    };

    const acceptInput = async () => {
        setResults([]);
        setChooseIssuesDocuments([]);
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

    return (
        <InsertDocumentsContext.Provider
            value={{
                identifier,
                setIdentifier,

                categories,
                category,
                setCategory,

                insertAnother,
                setInsertAnother,

                value,
                setValue: handleSetValue,
                fileUploadValues,
                handleFileUpload,
                updateFileUploadRow,
                clearFileUploadValues,

                acceptInput,
                results,
                chooseIssuesDocuments,
                createIssue,
                creatingIssues,
                createdIssues,
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
