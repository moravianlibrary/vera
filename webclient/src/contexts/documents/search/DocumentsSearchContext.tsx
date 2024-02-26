import React, { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { DocumentsQuery } from "../../../adapters/ApiDocuments";
import { SearchGroup } from "./SearchNodes";
import { DocumentField } from "./DocumentSearchField";
import ApiCategories, { Category } from "../../../adapters/ApiCategories";
import { TreeNode } from "primereact/treenode";
import ApiExtractions from "../../../adapters/ApiExtractions";

interface TreeOption {
    id: number;
    label: string;
}

interface DocumentsSearchContextProps {
    rootSearchNode: SearchGroup | undefined;
    activeQuery: DocumentsQuery | undefined;
    handleApplyFilter: () => void;
    handleSaveFilter: () => void;
    handleClearFilter: () => void;
    getTreeFieldOptions: (enumField: DocumentField) => TreeNode[];
    getTreeFieldPlaceholder: (enumField: DocumentField) => string;
}

interface DocumentsSearchProviderProps {
    children: ReactNode;
    extractionId?: number | null;
}

const DocumentsSearchContext = createContext<DocumentsSearchContextProps | undefined>(undefined);

export const DocumentsSearchProvider: React.FC<DocumentsSearchProviderProps> = ({ children, extractionId }) => {
    const [rootSearchNode, setRootSearchNode] = useState<SearchGroup>(SearchGroup.init());
    const [activeQuery, setActiveQuery] = useState<DocumentsQuery | undefined>(undefined);

    const [categoryTree, setCategoryTree] = useState<TreeNode[]>([]);

    const handleApplyFilter = () => {
        setActiveQuery({ search_group: rootSearchNode });
    };

    const handleSaveFilter = () => {
        localStorage.setItem('advanced_search', JSON.stringify(rootSearchNode));
    };

    const handleClearFilter = () => {
        setRootSearchNode(SearchGroup.createEmpty());
        console.log(SearchGroup.createEmpty());
    };

    const getTreeFieldOptions = (enumField: DocumentField) => {
        switch (enumField) {
            case DocumentField.Category: return categoryTree;
            default: return [];
        }
    };

    const getTreeFieldPlaceholder = (enumField: DocumentField) => {
        switch (enumField) {
            case DocumentField.Category: return "Choose a category";
            default: return "";
        } 
    };

    const contextValue: DocumentsSearchContextProps = {
        rootSearchNode,
        activeQuery,
        handleApplyFilter,
        handleSaveFilter,
        handleClearFilter,
        getTreeFieldOptions,
        getTreeFieldPlaceholder
    };

    const transformCategoryToTreeNode = (category: Category) => {
        const node = {
            id: category.id,
            key: category.id,
            label: category.name,
            children: children ? category.children.map(transformCategoryToTreeNode) : []
        }
        return node;
    }

    useEffect(() => {
        ApiCategories.getCategories()
        .then(response => {
            setCategoryTree(response.data.map(transformCategoryToTreeNode));
        }).catch(error => {
            console.error(error);
        });
    }, [])
    
    useEffect(() => {
        if (extractionId) {
            ApiExtractions.getExtraction(extractionId)
            .then(response => {
                setActiveQuery({ id_list: response.data.document_ids, sort: { field: DocumentField.Category } });
            }).catch(error => {
                console.error(error);
            });
        }
    }, [extractionId])

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
