import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiDocuments from "../../adapters/ApiDocuments";
import { VirtualScrollerLazyEvent } from "primereact/virtualscroller";
import DocumentModel from "./DocumentModel";
import { useDocumentsQuery } from "./search/DocumentsQueryContext";

interface DocumentsContextProps {
    documents: DocumentModel[];
    numFound: number;
    lazyLoad: (event: VirtualScrollerLazyEvent) => void;
    refresh: () => void;
    refreshDocumentsInResults: (documents: DocumentModel[]) => void;
    removeDocumentsFromResults: (documentIds: number[]) => void;

    offset: number;
    setOffset: (offset: number) => void;
    limit: number;
    setLimit: (limit: number) => void;
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
    const { query, isQueryAll } = useDocumentsQuery();

    const loadAmount = 50;

    const [documents, setDocuments] = useState<DocumentModel[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(loadAmount);

    const fetchDocuments = async (offset: number): Promise<DocumentModel[]> => {
        try {
            const response = isQueryAll
                ? await ApiDocuments.getDocuments(offset, limit)
                : await ApiDocuments.queryDocuments(query, offset, limit);

            setNumFound(response.data.num_found);
            return response.data.documents.map((document) => {
                return new DocumentModel(document);
            });
        } catch (error) {
            console.error(`Could not fetch documents: ${error}`);
            throw error;
        }
    };

    const loadDocuments = async (offset: number) => {
        fetchDocuments(offset).then((fetchedDocuments) => {
            setDocuments([...fetchedDocuments]);
            // if (offset === 0) {
            //     setDocuments([...fetchedDocuments]);
            // } else {
            //     const oldDocumentsIds = documents.map((d) => d.id);
            //     const newDocuments = fetchedDocuments.filter(
            //         (document) => !oldDocumentsIds.includes(document.id)
            //     );
            //     setDocuments([...documents, ...newDocuments]);
            // }
        });
    };

    const lazyLoad = (event: VirtualScrollerLazyEvent) => {
        if (typeof event.last !== "number") {
            return;
        }

        const last = event.last as number;
        const limit = offset + loadAmount / 2;
        if (limit <= last && offset + loadAmount < numFound) {
            loadDocuments(offset + loadAmount);
            setOffset(offset + loadAmount);
        }
    };

    const refresh = async () => {
        setOffset(0);
        await loadDocuments(0);
    };

    const refreshDocumentsInResults = (documents: DocumentModel[]) => {
        const documentsMap = Object.fromEntries(
            documents.map((document) => [document.id, document])
        );
        setDocuments((prevDocuments) =>
            prevDocuments.map((document) => {
                if (documentsMap[document.id]) {
                    return documentsMap[document.id];
                } else {
                    return document;
                }
            })
        );
    };

    const removeDocumentsFromResults = (documentIds: number[]) => {
        setDocuments((prevDocuments) =>
            prevDocuments.filter((d) => !documentIds.includes(d.id))
        );
        setOffset(Math.max(0, offset - documentIds.length));
    };

    useEffect(() => {
        loadDocuments(offset);
    }, [offset, limit]);

    useEffect(() => {
        refresh();
    }, [query, isQueryAll]);

    const contextValue: DocumentsContextProps = {
        documents,
        numFound,
        lazyLoad,
        refresh,
        refreshDocumentsInResults,
        removeDocumentsFromResults,

        offset,
        setOffset,
        limit,
        setLimit,
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
