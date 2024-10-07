import React, { createContext, useContext, ReactNode, useState } from "react";
import ApiDocuments, { IndexDocument } from "../../adapters/ApiDocuments";
import DocumentModel from "./DocumentModel";
import { TaskType } from "../../types/TaskType";
import ApiTasks, { EsQuery } from "../../adapters/ApiTasks";
import { useToast } from "../ToastContext";
import { useTranslation } from "react-i18next";
import { useDocuments } from "./DocumentsContext";
import { useDocumentsSelection } from "./DocumentsSelectionContext";

interface DocumentsActionsContextProps {
    detailsDocuments: IndexDocument[];
    showDocumentDetails: (document: IndexDocument) => void;
    closeDocumentDetails: (documentId: number) => void;

    updateDocument: (document: DocumentModel) => void;
    deleteDocument: (document: DocumentModel) => void;

    exportDocuments: () => void;
    updateCategory: (category_id: number, category_name: string) => void;
    startTask: (taskType: TaskType) => void;
    deleteDocuments: () => void;
}

const DocumentsActionsContext = createContext<
    DocumentsActionsContextProps | undefined
>(undefined);

interface DocumentsActionsProviderProps {
    children: ReactNode;
}

export const DocumentsActionsProvider: React.FC<
    DocumentsActionsProviderProps
> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const {
        documents,
        refresh,
        refreshDocumentsInResults,
        removeDocumentsFromResults,
    } = useDocuments();
    const { selectionQuery } = useDocumentsSelection();

    const [detailsDocuments, setDetailsDocuments] = useState<IndexDocument[]>(
        []
    );

    const showDocumentDetails = (document: IndexDocument) => {
        setDetailsDocuments([...detailsDocuments, document]);
    };

    const closeDocumentDetails = (documentId: number) => {
        setDetailsDocuments(
            detailsDocuments.filter((document) => document.id !== documentId)
        );
    };

    const updateDocument = async (document: DocumentModel) => {
        ApiDocuments.updateDocument(document).then((response) => {
            refreshDocumentsInResults([new DocumentModel(response.data)]);
        });
    };

    const deleteDocument = async (document: DocumentModel) => {
        ApiDocuments.deleteDocument(document.id).then((response) => {
            removeDocumentsFromResults([response.data.id]);
        });
    };

    const exportDocuments = async () => {
        ApiDocuments.exportDocuments(selectionQuery)
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

    const refreshDocumentsWithCategory = (
        document_ids: number[],
        category_id: number,
        category_name: string
    ) => {
        documents.map((d) => {
            if (document_ids.includes(d.id)) {
                d.category_id = category_id;
                d.category_name = category_name;
            }
            return d;
        });
    };

    const updateCategory = (category_id: number, category_name: string) => {
        ApiDocuments.updateCategory(selectionQuery, category_id)
            .then((response) => {
                if (response.data.id_list) {
                    refreshDocumentsWithCategory(
                        response.data.id_list,
                        category_id,
                        category_name
                    );
                } else {
                    refresh();
                }
                showToast("success", t("Category changed successfully"), "");
            })
            .catch((error) => {
                console.error(`Could not update documents category: ${error}`);
            });
    };

    const startTask = async (taskType: TaskType) => {
        ApiTasks.planTask(taskType, selectionQuery as EsQuery).then(
            (response) => {
                showToast("success", t("Task started successfully"), "");
            }
        );
    };

    const deleteDocuments = () => {
        ApiDocuments.deleteDocuments(selectionQuery)
            .then((response) => {
                if (response.data.id_list) {
                    removeDocumentsFromResults(response.data.id_list);
                } else {
                    refresh();
                }
            })
            .catch((error) => {
                console.error(`Could not update documents category: ${error}`);
            });
    };

    const contextValue: DocumentsActionsContextProps = {
        detailsDocuments,
        showDocumentDetails,
        closeDocumentDetails,

        updateDocument,
        deleteDocument,
        exportDocuments,
        updateCategory,
        startTask,
        deleteDocuments,
    };

    return (
        <DocumentsActionsContext.Provider value={contextValue}>
            {children}
        </DocumentsActionsContext.Provider>
    );
};

export const useDocumentsActions = (): DocumentsActionsContextProps => {
    const context = useContext(DocumentsActionsContext);

    if (!context) {
        throw new Error(
            "useDocumentsActions must be used within a DocumentsActionsProvider"
        );
    }

    return context;
};
