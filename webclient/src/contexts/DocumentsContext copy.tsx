import React, { createContext, useContext, useState } from "react";
import ApiDocuments, {
    IndexDocument,
    UpdateAttributes,
} from "../adapters/ApiDocuments";
import { useTranslation } from "react-i18next";
import { DataTableExpandedRowsProps } from "./base/DataTableExpandedRowsInjector";
import useDataTableExpandedRows from "./base/DataTableExpandedRowsInjector";
import { useNotification } from "./NotificationContext";
import { BaseProviderProps } from "./BaseContext";
import useElasticsearch, { EsContextProps } from "../elasticsearch/EsContext";
import { IndexSettingsDispatcher } from "../config/IndexSettingsDispatcher";

interface NewDocumentsContextProps
    extends EsContextProps<IndexDocument>,
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

const NewDocumentsContext = createContext<NewDocumentsContextProps | undefined>(
    undefined
);

const NewDocumentsProvider: React.FC<BaseProviderProps> = ({ children }) => {
    const api = new ApiDocuments();
    const { showSuccess, showConfirmDialog, showConfirmDangerDialog } =
        useNotification();
    const { t } = useTranslation("documents");
    const { items, numFound, refresh, updateItem, ...restOfPaginationProps } =
        useElasticsearch<IndexDocument>(
            IndexSettingsDispatcher.documents,
            api.search
        );
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
        // api.exportDocuments(selectedQuery)
        //     .then((response) => {
        //         const blob = new Blob([response.data], {
        //             type: response.headers["content-type"],
        //         });
        //         const url = window.URL.createObjectURL(blob);
        //         const link = document.createElement("a");
        //         link.href = url;
        //         link.download = "documents.xlsx";
        //         document.body.appendChild(link);
        //         link.click();
        //         document.body.removeChild(link);
        //         window.URL.revokeObjectURL(url);
        //     })
        //     .catch((error) => {
        //         console.error(`Could not export documents: ${error}`);
        //     });
    };

    const updateCategory = (categoryId: number, categoryName: string) => {
        // showConfirmDialog(
        //     t("actions.update-category.confirm", {
        //         category: categoryName,
        //         count: numSelected,
        //     }),
        //     () =>
        //         api
        //             .updateProperty(selectedQuery, { category_id: categoryId })
        //             .then((response) => {
        //                 refresh();
        //                 showSuccess(t("actions.update-category.success"));
        //             })
        //             .catch((error) => {
        //                 console.error(
        //                     `Could not update documents category: ${error}`
        //                 );
        //             })
        // );
    };

    const updateExtractionPriority = (extractionPriority: number) => {
        // showConfirmDialog(
        //     t(
        //         `actions.update-extraction-priority.confirm.${extractionPriority}`,
        //         {
        //             count: numSelected,
        //         }
        //     ),
        //     () =>
        //         api
        //             .updateProperty(selectedQuery, {
        //                 extraction_priority: extractionPriority,
        //             })
        //             .then((response) => {
        //                 refresh();
        //                 showSuccess(
        //                     t("actions.update-extraction-priority.success")
        //                 );
        //             })
        //             .catch((error) => {
        //                 console.error(
        //                     `Could not update documents extraction priority: ${error}`
        //                 );
        //             })
        // );
    };

    const updatePageCount = (pageCount: number) => {
        // showConfirmDialog(
        //     t("actions.update-page-count.confirm", {
        //         page_count: pageCount,
        //         count: numSelected,
        //     }),
        //     () =>
        //         api
        //             .updateProperty(selectedQuery, {
        //                 page_count_manual: pageCount,
        //             })
        //             .then((response) => {
        //                 refresh();
        //                 showSuccess(t("actions.update-page-count.success"));
        //             })
        //             .catch((error) => {
        //                 console.error(
        //                     `Could not update documents category: ${error}`
        //                 );
        //             })
        // );
    };

    const deleteDocuments = () => {
        // showConfirmDangerDialog(
        //     t("actions.delete.confirm", {
        //         count: numSelected,
        //     }),
        //     () =>
        //         api
        //             .deleteDocuments(selectedQuery)
        //             .then((response) => {
        //                 refresh();
        //                 showSuccess(
        //                     t("actions.delete.success", { count: numSelected })
        //                 );
        //             })
        //             .catch((error) => {
        //                 console.error(`Could not delete documents: ${error}`);
        //             })
        // );
    };

    const contextValue: NewDocumentsContextProps = {
        items,
        numFound,
        refresh,
        updateItem,
        ...restOfPaginationProps,

        // selectedQuery,
        // numSelected,
        // ...restOfSelectionProps,

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
        <NewDocumentsContext.Provider value={contextValue}>
            {children}
        </NewDocumentsContext.Provider>
    );
};

const useNewDocuments = (): NewDocumentsContextProps => {
    const context = useContext(NewDocumentsContext);

    if (!context) {
        throw new Error(
            "useNewDocuments must be used within a NewDocumentsProvider"
        );
    }

    return context;
};

export default useNewDocuments;
export { NewDocumentsProvider };
