import React, { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { IdentifierType } from "../../types/IdentifierType";
import { useTranslation } from "react-i18next";
import { useAssignableCategories } from "../categories/CategoriesContext";
import ApiDocuments, { DocumentCreationResponse, Identifier, Issue } from "../../adapters/ApiDocuments";
import CreateResult from "../../documents/models/CreateResult";
import { DocumentCreationStatus } from "../../types/DocumentCreationStatus";
import { Category } from "../../adapters/ApiCategories";

interface LabeledIdentifier extends Identifier {
    label: string;
}

interface InsertDocumentsContextProps {
    identifiers: LabeledIdentifier[];
    identifier: LabeledIdentifier;
    setIdentifier: (type: IdentifierType) => void;
    categories: Category[];
    category: number | null;
    setCategory: (category: number | null) => void;
    setValue: (value: string) => void;
    acceptInput: () => void;
    chooseIssuesDocuments: DocumentCreationResponse[];
    createIssue: (index: number, issue: Issue) => void;
    creatingIssues: Issue[];
    createdIssues: Issue[];
    results: DocumentCreationResponse[];
}

interface InsertDocumentsProviderProps {
    children: ReactNode;
}

const InsertDocumentsContext = createContext<InsertDocumentsContextProps | undefined>(undefined);

export const InsertDocumentsProvider: React.FC<InsertDocumentsProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const { fetchCategories } = useAssignableCategories();

    // First step variables
    const identifiers = [
        {
            identifier_type: IdentifierType.Sysno,
            value: "",
            label: t(IdentifierType.Sysno.toLowerCase())
        }, {
            identifier_type: IdentifierType.Barcode,
            value: "",
            label: t(IdentifierType.Barcode.toLowerCase())
    }];
    const [identifier, setIdentifier] = useState<LabeledIdentifier>(identifiers[0]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [category, setCategory] = useState<number | null>(null);

    // Second step variables
    const [filePath, setFilePath] = useState<string | null>(null);
    
    // Third step variables
    const [chooseIssuesDocuments, setChooseIssuesDocuments] = useState<DocumentCreationResponse[]>([]);
    const [creatingIssues, setCreatingIssues] = useState<Issue[]>([]);
    const [createdIssues, setCreatedIssues] = useState<Issue[]>([]);

    // Fourth step variables
    const [results, setResults] = useState<DocumentCreationResponse[]>([]);

    // First step functions
    const setIdentifierByType = (type: IdentifierType) => {
        const filteredIdentifiers = identifiers.filter(i => i.value === type);
        if (filteredIdentifiers.length === 1) {
            setIdentifier(filteredIdentifiers[0]);
        }
    };

    // Second step functions
    const setValue = (value: string) => {
        setIdentifier({...identifier, value: value});
    };

    const acceptInput = async () => {
        console.log(category);
        ApiDocuments.insertDocument(identifier, category, false)
        .then(response => {
            if (response.data.create_result === CreateResult.MULTIPLE_ISSUE_CHOICES) {
                setChooseIssuesDocuments([response.data]);
                setResults([]);
            } else {
                setChooseIssuesDocuments([]);
                setResults([response.data]);
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
            if (response.data.create_result !== DocumentCreationStatus.Success) {
                console.error('Could not create given issue. This code should be unreachable.');;
            }
            setCreatingIssues(prevCreatingIssues => prevCreatingIssues.filter(i => i.barcode !== issue.barcode));
            setCreatedIssues(prevCreatedIssues => [...prevCreatedIssues, issue]);
            setResults(prevResults => [...prevResults, response.data]);
        }).catch(error => {
            console.error(`Error while inserting document: ${error}`);
        });
    };

    const fetchData = async () => {
        const fetchedCategories = await fetchCategories();
        setCategories(fetchedCategories);
    };

    useEffect(() => {
        fetchData();
    }, [fetchCategories]);

    return (
        <InsertDocumentsContext.Provider value={{
            identifiers, identifier, setIdentifier: setIdentifierByType,
            categories, category, setCategory,
            setValue, acceptInput,
            chooseIssuesDocuments, createIssue, creatingIssues, createdIssues,
            results
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
