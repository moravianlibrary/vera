import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import DocumentModel from "./DocumentModel";
import { useDocumentsQuery } from "./search/DocumentsQueryContext";
import { useDocuments } from "./DocumentsContext";
import { DocumentsQuery } from "../../adapters/ApiDocuments";

interface DocumentsSelectionContextProps {
    selectedDocuments: DocumentModel[];
    selectionQuery: DocumentsQuery;
    numSelected: number;
    selectDocuments: (selectedDocuments: DocumentModel[]) => void;
    selectAllDocuments: (value: boolean) => void;
    cancelSelection: () => void;
}

const DocumentsSelectionContext = createContext<
    DocumentsSelectionContextProps | undefined
>(undefined);

interface DocumentsSelectionProviderProps {
    children: ReactNode;
}

export const DocumentsSelectionProvider: React.FC<
    DocumentsSelectionProviderProps
> = ({ children }) => {
    const { query } = useDocumentsQuery();
    const { documents, numFound } = useDocuments();

    const [selectedDocuments, setSelectedDocuments] = useState<DocumentModel[]>(
        []
    );
    const [selectionQuery, setSelectionQuery] = useState<DocumentsQuery>({});
    const [numSelected, setNumSelected] = useState<number>(0);
    const [selectAll, setSelectAll] = useState<boolean>(false);

    const selectDocuments = (selectedDocuments: DocumentModel[]) => {
        setSelectedDocuments(selectedDocuments);
        setNumSelected(selectedDocuments.length);
        setSelectAll(false);
        if (selectedDocuments.length > 0) {
            setSelectionQuery({ id_list: selectedDocuments.map((d) => d.id) });
        } else {
            setSelectionQuery({});
        }
    };

    const selectAllDocuments = (value: boolean) => {
        if (value) {
            setSelectedDocuments([...documents]);
            setNumSelected(numFound);
            setSelectAll(true);
            setSelectionQuery(query);
        } else {
            selectDocuments([]);
        }
    };

    const cancelSelection = () => {
        selectDocuments([]);
    };

    useEffect(() => {
        if (numSelected === 0) {
            return;
        }
        if (selectAll) {
            setSelectedDocuments([...documents]);
        } else {
            const selectedDocumentsIds = new Set(
                selectedDocuments.map((document) => document.id)
            );
            selectDocuments(
                documents.filter((document) =>
                    selectedDocumentsIds.has(document.id)
                )
            );
        }
    }, [documents]);

    const contextValue: DocumentsSelectionContextProps = {
        selectedDocuments,
        selectionQuery,
        numSelected,
        selectDocuments,
        selectAllDocuments,
        cancelSelection,
    };

    return (
        <DocumentsSelectionContext.Provider value={contextValue}>
            {children}
        </DocumentsSelectionContext.Provider>
    );
};

export const useDocumentsSelection = (): DocumentsSelectionContextProps => {
    const context = useContext(DocumentsSelectionContext);

    if (!context) {
        throw new Error(
            "useDocumentsSelection must be used within a DocumentsSelectionProvider"
        );
    }

    return context;
};
