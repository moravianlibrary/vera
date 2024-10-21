import React, {
    createContext,
    useContext,
    ReactNode,
    useState,
    useEffect,
} from "react";
import ApiDocuments, { IndexDocument } from "../adapters/ApiDocuments";
import { useTranslation } from "react-i18next";
import { EsItemsPaginationProps } from "./base/EsPaginationInjector";
import { stateToQuery, stateToRoute } from "../data/factories/EsQueriesFactory";
import { EsItemsSelectionProps } from "./base/EsSelectionInjector";
import useEsSelection from "./base/EsSelectionInjector";
import useEsPagination from "./base/EsPaginationInjector";
import { DataTableExpandedRowsProps } from "./base/DataTableExpandedRowsInjector";
import useDataTableExpandedRows from "./base/DataTableExpandedRowsInjector";
import { useNotification } from "./NotificationContext";

interface DocumentsContextProps
    extends EsItemsPaginationProps<IndexDocument>,
        EsItemsSelectionProps<IndexDocument>,
        DataTableExpandedRowsProps {
    exportDocuments: () => void;
    updateCategory: (categoryId: number, categoryName: string) => void;
    updateExtractionPriority: (extractionPriority: number) => void;
    updatePageCount: (pagesCount: number) => void;
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
    const { showSuccess, showConfirmDialog, showConfirmDangerDialog } =
        useNotification();
    const { t } = useTranslation("documents");
    const { items, numFound, queryParams, refresh, ...restOfPaginationProps } =
        useEsPagination(
            (uiState) => stateToQuery("documents", uiState),
            (uiState) => stateToRoute("documents", uiState)
        );
    const { selectedQuery, numSelected, ...restOfSelectionProps } =
        useEsSelection(items, numFound, queryParams);
    const { reset, ...restOfExpandedRowsProps } = useDataTableExpandedRows();

    const [digitizationListIdFacets, setDigitizationListIdFacets] = useState<
        string[]
    >([]);

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

    const updateCategory = (categoryId: number, categoryName: string) => {
        showConfirmDialog(
            t("actions.update-category.confirm", {
                category: categoryName,
                count: numSelected,
            }),
            () =>
                api
                    .updateProperty(selectedQuery, { category_id: categoryId })
                    .then((response) => {
                        refresh();
                        showSuccess(t("actions.update-category.success"));
                    })
                    .catch((error) => {
                        console.error(
                            `Could not update documents category: ${error}`
                        );
                    })
        );
    };

    const updateExtractionPriority = (extractionPriority: number) => {
        showConfirmDialog(
            t(
                `actions.update-extraction-priority.confirm.${extractionPriority}`,
                {
                    count: numSelected,
                }
            ),
            () =>
                api
                    .updateProperty(selectedQuery, {
                        extraction_priority: extractionPriority,
                    })
                    .then((response) => {
                        refresh();
                        showSuccess(
                            t("actions.update-extraction-priority.success")
                        );
                    })
                    .catch((error) => {
                        console.error(
                            `Could not update documents extraction priority: ${error}`
                        );
                    })
        );
    };

    const updatePageCount = (pageCount: number) => {
        showConfirmDialog(
            t("actions.update-page-count.confirm", {
                page_count: pageCount,
                count: numSelected,
            }),
            () =>
                api
                    .updateProperty(selectedQuery, {
                        pages_count_manual: pageCount,
                    })
                    .then((response) => {
                        refresh();
                        showSuccess(t("actions.update-page-count.success"));
                    })
                    .catch((error) => {
                        console.error(
                            `Could not update documents category: ${error}`
                        );
                    })
        );
    };

    const deleteDocuments = () => {
        showConfirmDangerDialog(
            t("actions.delete.confirm", {
                count: numSelected,
            }),
            () =>
                api
                    .deleteDocuments(selectedQuery)
                    .then((response) => {
                        refresh();
                        showSuccess(t("actions.delete.success"));
                    })
                    .catch((error) => {
                        console.error(`Could not delete documents: ${error}`);
                    })
        );
    };

    useEffect(() => {
        reset();
    }, [reset, queryParams]);

    const contextValue: DocumentsContextProps = {
        items,
        numFound,
        queryParams,
        refresh,
        ...restOfPaginationProps,

        selectedQuery,
        numSelected,
        ...restOfSelectionProps,

        ...restOfExpandedRowsProps,
        reset,

        exportDocuments,
        updateCategory,
        updateExtractionPriority,
        updatePageCount,
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
