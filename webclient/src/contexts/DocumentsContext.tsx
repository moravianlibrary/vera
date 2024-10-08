import React, {
    createContext,
    useContext,
    ReactNode,
    useState,
    useEffect,
} from "react";
import ApiDocuments, { IndexDocument } from "../adapters/ApiDocuments";
import { useEsDataTable } from "./EsDataTableContext";
import { useToast } from "./ToastContext";
import { useTranslation } from "react-i18next";
import { useInstantSearch } from "react-instantsearch";

interface DocumentsContextProps {
    detailsDocuments: IndexDocument[];
    showDocumentDetails: (document: IndexDocument) => void;
    closeDocumentDetails: (documentId: number) => void;

    exportDocuments: () => void;
    updateCategory: (category_id: number) => void;
    deleteDocuments: () => void;

    digitizationListIdFacets: string[];
}

const DocumentsContext = createContext<DocumentsContextProps | undefined>(
    undefined
);

interface DocumentsProviderProps {
    children: ReactNode;
}

export const DocumentsProvider: React.FC<DocumentsProviderProps> = ({
    children,
}) => {
    const api = new ApiDocuments();
    const showToast = useToast();
    const { t } = useTranslation();
    const { selectedQuery, refresh } = useEsDataTable();
    const { uiState } = useInstantSearch();

    const [detailsDocuments, setDetailsDocuments] = useState<IndexDocument[]>(
        []
    );
    const [digitizationListIdFacets, setDigitizationListIdFacets] = useState<
        string[]
    >([]);

    const showDocumentDetails = (document: IndexDocument) => {
        setDetailsDocuments([...detailsDocuments, document]);
    };

    const closeDocumentDetails = (documentId: number) => {
        setDetailsDocuments(
            detailsDocuments.filter((document) => document.id !== documentId)
        );
    };

    const exportDocuments = async () => {
        api.exportDocuments(selectedQuery)
            .then((response) => {
                const blob = new Blob([response.data], {
                    type: response.headers["content-type"],
                });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "documents.xlsx";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            })
            .catch((error) => {
                console.error(`Could not export documents: ${error}`);
            });
    };

    const updateCategory = (category_id: number) => {
        api.updateCategory(selectedQuery, category_id)
            .then((response) => {
                refresh();
                showToast("success", t("Category changed successfully"), "");
            })
            .catch((error) => {
                console.error(`Could not update documents category: ${error}`);
            });
    };

    const deleteDocuments = () => {
        api.deleteDocuments(selectedQuery)
            .then((response) => {
                refresh();
            })
            .catch((error) => {
                console.error(`Could not update documents category: ${error}`);
            });
    };

    useEffect(() => {
        if (
            uiState &&
            uiState.documents &&
            uiState.documents.refinementList &&
            uiState.documents.refinementList.digitization_list_id
        ) {
            setDigitizationListIdFacets(
                uiState.documents.refinementList.digitization_list_id
            );
        } else if (digitizationListIdFacets.length > 0) {
            setDigitizationListIdFacets([]);
        }
    }, [uiState]);

    const contextValue: DocumentsContextProps = {
        detailsDocuments,
        showDocumentDetails,
        closeDocumentDetails,

        exportDocuments,
        updateCategory,
        deleteDocuments,

        digitizationListIdFacets,
    };

    return (
        <DocumentsContext.Provider value={contextValue}>
            {children}
        </DocumentsContext.Provider>
    );
};

export const useDocuments = (): DocumentsContextProps => {
    const context = useContext(DocumentsContext);

    if (!context) {
        throw new Error("useDocuments must be used within a DocumentsProvider");
    }

    return context;
};
