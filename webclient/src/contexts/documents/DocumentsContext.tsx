import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiDocuments, { Document, DocumentsQuery } from "../../adapters/ApiDocuments";
import { VirtualScrollerLazyEvent } from "primereact/virtualscroller";
import DocumentModel from "./DocumentModel";
import { TaskType } from "../../types/TaskType";
import ApiTasks from "../../adapters/ApiTasks";

interface DocumentsContextProps {
    documents: Document[];
    handleLazyLoad: (event: VirtualScrollerLazyEvent) => void;
    handleDeleteDocument: (document: DocumentModel) => void;
    handleUpdateDocument: (updatedDocument: DocumentModel, index: number) => void;
    selectedDocuments: Document[];
    handleSelectDocuments: (selectedDocuments: DocumentModel[]) => void;
    handleStartTask: (taskType: TaskType) => void;
}

const DocumentsContext = createContext<DocumentsContextProps | undefined>(undefined);

interface DocumentsProviderProps {
    children: ReactNode;
}

export const DocumentsProvider: React.FC<DocumentsProviderProps> = ({ children }) => {
    const loadAmount = 50;
    const [offset, setOffset] = useState<number>(0);
    const [documents, setDocuments] = useState<DocumentModel[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [selectedDocuments, setSelectedDocuments] = useState<DocumentModel[]>([]);

    const loadDocuments = async (offset: number) => {
        ApiDocuments.getDocuments(offset, loadAmount)
        .then(response => {
            const transformedData: DocumentModel[] = response.data.documents.map(document => {
                return new DocumentModel(document);
            });
            setDocuments([...documents, ...transformedData]);
            setNumFound(response.data.num_found);
        }).catch(error => {
            console.error(`Could not receive documents: ${error}`);
        });
    };

    const handleLazyLoad = (event: VirtualScrollerLazyEvent) => {
        const { last } = event;

        if (typeof last === 'number' && last >= offset + loadAmount) {
            setOffset(offset + loadAmount);
            loadDocuments(offset + loadAmount);
        }
    };
    
    const handleDeleteDocument = async (document: DocumentModel) => {
        const deletedDocument = await ApiDocuments.deleteDocument(document.id);
        if (deletedDocument !== null) {
            const editedDocuments = documents.filter(d => d.id !== document.id);
            setDocuments(editedDocuments);
            setOffset(offset - 1);
            // TODO: deleting documents makes lazy load reload one page two times
        }
    };

    const handleUpdateDocument = async (updatedDocument: DocumentModel, index: number) => {
        ApiDocuments.updateDocument(updatedDocument)
        .then(response => {
            setDocuments(prevDocuments => [
                ...prevDocuments.slice(0, index),
                new DocumentModel(response.data as Document),
                ...prevDocuments.slice(index + 1),
            ]); 
        })
    };

    const handleSelectDocuments = (selectedDocuments: DocumentModel[]) => {
        setSelectedDocuments(selectedDocuments);
    };

    const handleStartTask = async (taskType: TaskType) => {
        const idList = selectedDocuments.map(d => d.id);
        const query: DocumentsQuery = { id_list: idList };
        ApiTasks.planTask(taskType, query);
    };

    const contextValue: DocumentsContextProps = {
        documents,
        handleLazyLoad,
        handleDeleteDocument,
        handleUpdateDocument,
        selectedDocuments,
        handleSelectDocuments,
        handleStartTask
    };

    useEffect(() => {
        loadDocuments(offset);
    }, []);

    return (
        <DocumentsContext.Provider value={contextValue}>
            {children}
        </DocumentsContext.Provider>
    );
};

export const useDocuments = (): DocumentsContextProps => {
    const context = useContext(DocumentsContext);

    if (!context) {
        throw new Error('useDocuments must be used within a DocumentsProvider');
    }

    return context;
};
