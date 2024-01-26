import React, { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { DocumentsQuery } from "../../../adapters/ApiDocuments";
import { SearchGroup, SearchNode } from "./SearchNodes";

interface DocumentsSearchContextProps {
    rootSearchNode: SearchNode | undefined;
    activeQuery: DocumentsQuery | undefined;
    handleApplyFilters: () => void;
    handleClearFilters: () => void;
}

const DocumentsSearchContext = createContext<DocumentsSearchContextProps | undefined>(undefined);

interface DocumentsSearchProviderProps {
    children: ReactNode;
}

export const DocumentsSearchProvider: React.FC<DocumentsSearchProviderProps> = ({ children }) => {
    const [rootSearchNode, setRootSearchNode] = useState<SearchNode>(SearchNode.init());
    const [activeQuery, setActiveQuery] = useState<DocumentsQuery | undefined>(undefined);

    const handleApplyFilters = () => {
        localStorage.setItem('advanced_search', JSON.stringify(rootSearchNode));
    };

    const handleClearFilters = () => {};

    const contextValue: DocumentsSearchContextProps = {
        rootSearchNode,
        activeQuery,
        handleApplyFilters,
        handleClearFilters
    };

    useEffect(() => {
        // setRootSearchNode(SearchGroup.getDefault());
    }, [])

    return (
        <DocumentsSearchContext.Provider value={contextValue}>
            {children}
        </DocumentsSearchContext.Provider>
    );
};

export const useDocumentsSearch = (): DocumentsSearchContextProps => {
    const context = useContext(DocumentsSearchContext);

    if (!context) {
        throw new Error('useDocumentsSearch must be used within a DocumentsSearchProvider');
    }

    return context;
};
