import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiDocuments, { Document, DocumentsQuery } from "../../adapters/ApiDocuments";
import { VirtualScrollerLazyEvent } from "primereact/virtualscroller";
import DocumentModel from "./DocumentModel";
import { TaskType } from "../../types/TaskType";
import ApiTasks from "../../adapters/ApiTasks";
import { SearchGroup } from "./search/SearchNodes";

interface DocumentsContextProps {
    documents: Document[];
    numFound: number;
    handleLazyLoad: (event: VirtualScrollerLazyEvent) => void;
    handleDeleteDocument: (document: DocumentModel) => void;
    handleUpdateDocument: (updatedDocument: DocumentModel, index: number) => void;
    selectedDocuments: Document[];
    handleSelectDocuments: (selectedDocuments: DocumentModel[]) => void;
    handleSelectAllDocuments: () => void;
    handleCancelSelection: () => void;
    selectAll: boolean;
    handleStartTask: (taskType: TaskType) => void;
    handleDeleteDocuments: () => void;
    handleUpdateCategory: (category_id: number, category_name: string) => void;
    handleExportDocuments: () => void;
}

const DocumentsContext = createContext<DocumentsContextProps | undefined>(undefined);

interface DocumentsProviderProps {
    children: ReactNode;
    query?: DocumentsQuery;
}

export const DocumentsProvider: React.FC<DocumentsProviderProps> = (props) => {
    const loadAmount = 50;
    const [offset, setOffset] = useState<number>(0);
    const [query, setQuery] = useState<DocumentsQuery | undefined>();
    const [documents, setDocuments] = useState<DocumentModel[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [selectedDocuments, setSelectedDocuments] = useState<DocumentModel[]>([]);
    const [selectAll, setSelectAll] = useState<boolean>(false);

    const loadDocuments = async (offset: number) => {
        ApiDocuments.getDocuments(offset, loadAmount)
        .then(response => {
            const transformedData: DocumentModel[] = response.data.documents.map(document => {
                return new DocumentModel(document);
            });
            if (offset === 0) {
                setDocuments([...transformedData]);
                if (selectAll) {
                    setSelectedDocuments([...transformedData]);
                }
            } else {
                setDocuments([...documents, ...transformedData]);
                if (selectAll) {
                    setSelectedDocuments([...selectedDocuments, ...transformedData]);
                }
            }
            setNumFound(response.data.num_found);
        }).catch(error => {
            console.error(`Could not receive documents: ${error}`);
        });
    };

    const loadQueryDocuments = async (offset: number) => {
        ApiDocuments.queryDocuments(query!, offset, loadAmount)
        .then(response => {
            const transformedData: DocumentModel[] = response.data.documents.map(document => {
                return new DocumentModel(document);
            });
            if (offset === 0) {
                setDocuments([...transformedData]);
                if (selectAll) {
                    setSelectedDocuments([...transformedData]);
                }
            } else {
                setDocuments([...documents, ...transformedData]);
                if (selectAll) {
                    setSelectedDocuments([...selectedDocuments, ...transformedData]);
                }
            }
            setNumFound(response.data.num_found);
        }).catch(error => {
            console.error(`Could not receive documents: ${error}`);
        });
    };

    const handleLazyLoad = (event: VirtualScrollerLazyEvent) => {
        const { last } = event;

        if (typeof last === 'number' && last >= offset + loadAmount) {
            setOffset(offset + loadAmount);
            if (query) {
                loadQueryDocuments(offset + loadAmount);
            } else {
                loadDocuments(offset + loadAmount);
            }
        }
    };
    
    const handleDeleteDocument = async (document: DocumentModel) => {
        const deletedDocument = await ApiDocuments.deleteDocument(document.id);
        if (deletedDocument !== null) {
            setDocuments(prevDocuments => prevDocuments.filter(d => d.id !== document.id));
            setSelectedDocuments(prevDocuments => prevDocuments.filter(d => d.id !== document.id));
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

    const handleSelectAllDocuments = () => {
        if (selectAll) {
            setSelectedDocuments([]);
        } else {
            setSelectedDocuments([...documents]);
        }
        setSelectAll(!selectAll);
    };

    const handleCancelSelection = () => {
        setSelectedDocuments([]);
        setSelectAll(false);
    };

    const handleStartTask = async (taskType: TaskType) => {
        const selectQuery = selectAll
                    ? query ? query : { search_group: SearchGroup.createEmpty() }
                    :{id_list: selectedDocuments.map(d => d.id)};
        ApiTasks.planTask(taskType, selectQuery);
    };

    const handleDeleteDocuments = () => {
        const selectQuery = selectAll
                    ? query ? query : { search_group: SearchGroup.createEmpty() }
                    :{id_list: selectedDocuments.map(d => d.id)};
        ApiDocuments.deleteDocuments(selectQuery)
        .then(response => {
            if (response.data.id_list) {
                setDocuments(prevDocuments => prevDocuments.filter(d => !response.data.id_list!.includes(d.id)));
                setSelectedDocuments(prevDocuments => prevDocuments.filter(d => !response.data.id_list!.includes(d.id)));
            } else {
                setOffset(0);
            }
        }).catch(error => {
            console.error(`Could not update documents category: ${error}`);
        });
    };

    const handleUpdateCategory = (category_id: number, category_name: string) => {
        const selectQuery = selectAll
                    ? query ? query : { search_group: SearchGroup.createEmpty() }
                    :{id_list: selectedDocuments.map(d => d.id)};
        ApiDocuments.updateCategory(selectQuery, category_id)
        .then(response => {
            if (response.data.id_list) {
                (documents.map(d => {
                    if (response.data.id_list!.includes(d.id)) {
                        d.category_id = category_id;
                        d.category_name = category_name;
                    }
                    return d;
                }));
                setDocuments(prevDocuments => prevDocuments.map(d => {
                    if (response.data.id_list!.includes(d.id)) {
                        d.category_id = category_id;
                        d.category_name = category_name;
                    }
                    return d;
                }));
            } else {
                setOffset(0);
            }
        }).catch(error => {
            console.error(`Could not update documents category: ${error}`);
        });
    };

    const handleExportDocuments = async () => {
        const selectQuery = selectAll
                    ? query ? query : { search_group: SearchGroup.createEmpty() }
                    :{id_list: selectedDocuments.map(d => d.id)};
        ApiDocuments.exportDocuments(selectQuery)
        .then(response => {
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'documents.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }).catch(error => {
            console.error(`Could not export documents: ${error}`);
        });
    };

    const contextValue: DocumentsContextProps = {
        documents,
        numFound,
        handleLazyLoad,
        handleDeleteDocument,
        handleUpdateDocument,
        selectedDocuments,
        handleSelectDocuments,
        handleSelectAllDocuments,
        handleCancelSelection,
        selectAll,
        handleStartTask,
        handleDeleteDocuments,
        handleUpdateCategory,
        handleExportDocuments,
    };

    useEffect(() => {
        if (query) {
            loadQueryDocuments(0);
        } else {
            loadDocuments(0);
        }
    }, [query]);

    useEffect(() => {
        setQuery(props.query);
    }, [props.query]);

    return (
        <DocumentsContext.Provider value={contextValue}>
            {props.children}
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
