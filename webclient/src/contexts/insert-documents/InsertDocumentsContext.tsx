import React, { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { IdentifierType } from "../../types/IdentifierType";
import { useTranslation } from "react-i18next";
import { useAssignableCategories } from "../categories/AssignableCategoriesContext";
import ApiDocuments, { DocumentCreationResponse, Identifier, Issue } from "../../adapters/ApiDocuments";
import { DocumentCreateResult } from "../../types/DocumentCreateResult";
import { AssignableCategory } from "../../adapters/ApiCategories";
import { useToast } from "../toast/ToastContext";
import InsertResultModel from "./InsertResultModel";

interface LabeledIdentifier {
    value: IdentifierType;
    label: string;
}

interface InsertDocumentsContextProps {
    identifiers: LabeledIdentifier[];
    identifier: LabeledIdentifier;
    setIdentifier: (type: IdentifierType) => void;
    categories: AssignableCategory[];
    category: number | null;
    setCategory: (category: number | null) => void;
    value: string;
    setValue: (value: string) => void;
    acceptInput: () => void;
    chooseIssuesDocuments: DocumentCreationResponse[];
    createIssue: (index: number, issue: Issue) => void;
    creatingIssues: Issue[];
    createdIssues: Issue[];
    result: InsertResultModel;
}

interface InsertDocumentsProviderProps {
    children: ReactNode;
}

const InsertDocumentsContext = createContext<InsertDocumentsContextProps | undefined>(undefined);

export const InsertDocumentsProvider: React.FC<InsertDocumentsProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { categories } = useAssignableCategories();

    // First step variables
    const identifiers = [
        {
            value: IdentifierType.Sysno,
            label: t("System number")
        }, {
            value: IdentifierType.Barcode,
            label: t("Barcode")
        }, {
            value: IdentifierType.Signature,
            label: t("Signature")
    }];
    const [identifier, setIdentifier] = useState<LabeledIdentifier>(identifiers[0]);
    const [category, setCategory] = useState<number | null>(null);

    // Second step variables
    const [value, setValue] = useState<string>("");
    const [filePath, setFilePath] = useState<string | null>(null);
    
    // Third step variables
    const [chooseIssuesDocuments, setChooseIssuesDocuments] = useState<DocumentCreationResponse[]>([]);
    const [creatingIssues, setCreatingIssues] = useState<Issue[]>([]);
    const [createdIssues, setCreatedIssues] = useState<Issue[]>([]);

    // Fourth step variables
    const [result, setResult] = useState<InsertResultModel>(new InsertResultModel());

    // First step functions
    const setIdentifierByType = (type: IdentifierType) => {
        const filteredIdentifiers = identifiers.filter(i => i.value === type);
        if (filteredIdentifiers.length === 1) {
            setIdentifier(filteredIdentifiers[0]);
        }
    };

    const acceptInput = async () => {
        const inputIdentifier: Identifier = {
            identifier_type: identifier.value,
            value: value
        }
        ApiDocuments.insertDocument(inputIdentifier, category, false)
        .then(response => {
            if (response.data.create_result === DocumentCreateResult.MultipleIssues) {
                setChooseIssuesDocuments([response.data]);
                setResult(new InsertResultModel());
            } else {
                setChooseIssuesDocuments([]);
                const newResult = new InsertResultModel();
                newResult.addDocumentResponse(response.data);
                setResult(newResult);
            }
            setValue("");
        }).catch(error => {
            console.error(`Error while inserting document: ${error}`);
        });
    };

    // Third step functions
    const createIssue = async (index: number, issue: Issue) => {
        setCreatingIssues(prevCreatingIssues => [...prevCreatingIssues, issue]);

        ApiDocuments.insertDocument({identifier_type: IdentifierType.Barcode, value: issue.barcode}, category, false)
        .then(response => {
            if (response.data.create_result !== DocumentCreateResult.Success) {
                console.error('Could not create given issue. This code should be unreachable.');;
            }
            setCreatingIssues(prevCreatingIssues => prevCreatingIssues.filter(i => i.barcode !== issue.barcode));
            setCreatedIssues(prevCreatedIssues => [...prevCreatedIssues, issue]);
            const messageProps = result.addDocumentResponse(response.data);
            showToast(messageProps.severity, t(messageProps.summary), t(messageProps.detail));
        }).catch(error => {
            console.error(`Error while inserting document: ${error}`);
        });
    };

    return (
        <InsertDocumentsContext.Provider value={{
            identifiers, identifier, setIdentifier: setIdentifierByType,
            categories, category, setCategory,
            value, setValue, acceptInput,
            chooseIssuesDocuments, createIssue, creatingIssues, createdIssues,
            result
        }}>
            {children}
        </InsertDocumentsContext.Provider>
    );
};

export const useInsertDocuments = () => {
    const context = useContext(InsertDocumentsContext);
    if (!context) {
        throw new Error('useInsertDocuments must be used within a InsertDocumentsProvider');
    }
    return context;
};
