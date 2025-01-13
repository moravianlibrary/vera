import React, {
    createContext,
    useContext,
    ReactNode,
    useState,
    useEffect,
} from "react";
import ApiDocuments, {
    IndexDocument,
    UpdateAttributes,
} from "../adapters/ApiDocuments";
import { useTranslation } from "react-i18next";
import { EsItemsPaginationProps } from "./base/EsPaginationInjector";
import { EsItemsSelectionProps } from "./base/EsSelectionInjector";
import useEsSelection from "./base/EsSelectionInjector";
import useEsPagination from "./base/EsPaginationInjector";
import { DataTableExpandedRowsProps } from "./base/DataTableExpandedRowsInjector";
import useDataTableExpandedRows from "./base/DataTableExpandedRowsInjector";
import { useNotification } from "./NotificationContext";
import { BaseProviderProps } from "./BaseContext";

interface DocumentsContextProps
    extends EsItemsPaginationProps<IndexDocument>,
        EsItemsSelectionProps<IndexDocument>,
        DataTableExpandedRowsProps {
    updateDocumentAttribute: (
        documentId: string,
        attribute: UpdateAttributes,
        value: any
    ) => void;
    deleteDocument: (documentId: string) => void;

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

const DocumentsProvider: React.FC<
    BaseProviderProps & {
        searchClient: {
            clearCache(): Promise<void>;
        };
    }
> = ({ searchClient, children }) => {
    const api = new ApiDocuments();
    const { showSuccess, showConfirmDialog, showConfirmDangerDialog } =
        useNotification();
    const { t } = useTranslation("documents");
    const {
        items,
        numFound,
        queryParams,
        queryRoute,
        refresh,
        updateItem,
        ...restOfPaginationProps
    } = useEsPagination<IndexDocument>();
    const { selectedQuery, numSelected, ...restOfSelectionProps } =
        useEsSelection();
    const { reset, ...restOfExpandedRowsProps } = useDataTableExpandedRows();

    const [digitizationListIdFacets, setDigitizationListIdFacets] = useState<
        string[]
    >([]);

    const updateDocumentAttribute = (
        documentId: string,
        attribute: UpdateAttributes,
        value: any
    ) => {
        api.updateDocument(documentId, { [attribute]: value })
            .then((response) => {
                updateItem(documentId, response.data);
                searchClient.clearCache();
                showSuccess(
                    t(`actions.update-${attribute.replace(/_/g, "-")}.success`)
                );
            })
            .catch((error) => {
                console.error(
                    t(`actions.update-${attribute}.failure`, { error })
                );
            });
    };

    const deleteDocument = (documentId: string) => {
        showConfirmDangerDialog(
            t("actions.delete.confirm", {
                count: 1,
            }),
            () =>
                api
                    .delete(documentId)
                    .then((response) => {
                        refresh();
                        showSuccess(t("actions.delete.success", { count: 1 }));
                    })
                    .catch((error) => {
                        console.error(`Could not delete documents: ${error}`);
                    })
        );
    };
    const exportDocuments = async () => {
        api.exportDocuments({
            ...selectedQuery,
            fields: "id,signature,barcode,sysno,volume,volume_year,bundle,isxn",
        })
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
                        page_count_manual: pageCount,
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
                        showSuccess(
                            t("actions.delete.success", { count: numSelected })
                        );
                    })
                    .catch((error) => {
                        console.error(`Could not delete documents: ${error}`);
                    })
        );
    };

    useEffect(() => {
        reset();
    }, [reset, queryParams.current, queryRoute.current]);

    const contextValue: DocumentsContextProps = {
        items,
        numFound,
        queryParams,
        queryRoute,
        refresh,
        updateItem,
        ...restOfPaginationProps,

        selectedQuery,
        numSelected,
        ...restOfSelectionProps,

        reset,
        ...restOfExpandedRowsProps,

        updateDocumentAttribute,
        deleteDocument,

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

export { DocumentsProvider, useDocuments };
