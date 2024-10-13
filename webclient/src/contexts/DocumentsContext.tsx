import React, { createContext, useContext, ReactNode, useState } from "react";
import ApiDocuments, { IndexDocument } from "../adapters/ApiDocuments";
import { useToast } from "./ToastContext";
import { useTranslation } from "react-i18next";
import { EsItemsPaginationProps } from "./base/EsPaginationInjector";
import { stateToRoute } from "../data/factories/EsQueriesFactory";
import { booleanAttributes } from "../config/documents_index";
import { EsItemsSelectionProps } from "./base/EsSelectionInjector";
import useEsSelection from "./base/EsSelectionInjector";
import useEsPagination from "./base/EsPaginationInjector";

interface DocumentsContextProps
    extends EsItemsPaginationProps<IndexDocument>,
        EsItemsSelectionProps<IndexDocument> {
    detailsDocuments: IndexDocument[];
    showDocumentDetails: (document: IndexDocument) => void;
    closeDocumentDetails: (documentId: string) => void;

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

const DocumentsProvider: React.FC<DocumentsProviderProps> = ({ children }) => {
    const api = new ApiDocuments();
    const showToast = useToast();
    const { t } = useTranslation();
    const { items, numFound, queryParams, refresh, ...restOfPaginationProps } =
        useEsPagination((uiState) =>
            stateToRoute("documents", booleanAttributes, uiState)
        );
    const { selectedQuery, ...restOfSelectionProps } = useEsSelection(
        items,
        numFound,
        queryParams
    );

    const [detailsDocuments, setDetailsDocuments] = useState<IndexDocument[]>(
        []
    );
    const [digitizationListIdFacets, setDigitizationListIdFacets] = useState<
        string[]
    >([]);

    const showDocumentDetails = (document: IndexDocument) => {
        setDetailsDocuments([...detailsDocuments, document]);
    };

    const closeDocumentDetails = (documentId: string) => {
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

    const contextValue: DocumentsContextProps = {
        items,
        numFound,
        queryParams,
        refresh,
        ...restOfPaginationProps,

        selectedQuery,
        ...restOfSelectionProps,

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

const useDocuments = (): DocumentsContextProps => {
    const context = useContext(DocumentsContext);

    if (!context) {
        throw new Error("useDocuments must be used within a DocumentsProvider");
    }

    return context;
};

export { DocumentsContext, DocumentsProvider, useDocuments };
