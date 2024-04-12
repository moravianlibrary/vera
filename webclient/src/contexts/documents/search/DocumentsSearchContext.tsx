import React, {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { DocumentsQuery } from "../../../adapters/ApiDocuments";
import { SearchGroup } from "./SearchNodes";
import { DocumentField } from "./DocumentSearchField";
import ApiCategories, { Category } from "../../../adapters/ApiCategories";
import { TreeNode } from "primereact/treenode";
import ApiGeneratedExtractions from "../../../adapters/ApiGeneratedExtractions";
import ApiDigitizationExtractions from "../../../adapters/ApiDigitizationExtractions";

interface TreeOption {
    id: number;
    label: string;
}

interface DocumentsSearchContextProps {
    rootSearchNode: SearchGroup | undefined;
    activeQuery: DocumentsQuery | undefined;
    searchPhrase: string;
    setSearchPhrase: (searchPhrase: string) => void;
    searchByPhrase: () => void;
    handleApplyFilter: () => void;
    handleCancelFilter: () => void;
    handleSaveFilter: () => void;
    handleClearFilter: () => void;
    getTreeFieldOptions: (enumField: DocumentField) => TreeNode[];
    getTreeFieldPlaceholder: (enumField: DocumentField) => string;
}

interface DocumentsSearchProviderProps {
    categoryIds?: number[];
    digitizationListId?: number | null;
    extractionId?: number | null;
    children: ReactNode;
}

const DocumentsSearchContext = createContext<
    DocumentsSearchContextProps | undefined
>(undefined);

export const DocumentsSearchProvider: React.FC<
    DocumentsSearchProviderProps
> = ({ children, digitizationListId, extractionId, categoryIds }) => {
    const [rootSearchNode, setRootSearchNode] = useState<SearchGroup>(
        SearchGroup.init()
    );
    const [activeQuery, setActiveQuery] = useState<DocumentsQuery | undefined>(
        undefined
    );
    const [searchPhrase, setSearchPhrase] = useState<string>("");
    const [triggerSearchTimer, setTriggerSearchTimer] = useState<
        NodeJS.Timeout | undefined
    >(undefined);

    const [categoryTree, setCategoryTree] = useState<TreeNode[]>([]);

    const searchByPhrase = () => {
        console.log(searchPhrase);
        if (searchPhrase !== "") {
            setActiveQuery({
                search_phrase: searchPhrase,
            });
        } else {
            setActiveQuery(undefined);
        }
    };

    useEffect(() => {
        clearTimeout(triggerSearchTimer);
        setTriggerSearchTimer(
            setTimeout(() => {
                searchByPhrase();
            }, 1000)
        );
    }, [searchPhrase]);

    const handleApplyFilter = () => {
        setActiveQuery({ search_group: rootSearchNode });
    };

    const handleCancelFilter = () => {
        setActiveQuery(undefined);
        setSearchPhrase("");
    };

    const handleSaveFilter = () => {
        localStorage.setItem("advanced_search", JSON.stringify(rootSearchNode));
    };

    const handleClearFilter = () => {
        setRootSearchNode(SearchGroup.createEmpty());
    };

    const getTreeFieldOptions = (enumField: DocumentField) => {
        switch (enumField) {
            case DocumentField.Category:
                return categoryTree;
            default:
                return [];
        }
    };

    const getTreeFieldPlaceholder = (enumField: DocumentField) => {
        switch (enumField) {
            case DocumentField.Category:
                return "Choose a category";
            default:
                return "";
        }
    };

    const contextValue: DocumentsSearchContextProps = {
        rootSearchNode,
        activeQuery,
        searchPhrase,
        setSearchPhrase,
        searchByPhrase,
        handleApplyFilter,
        handleCancelFilter,
        handleSaveFilter,
        handleClearFilter,
        getTreeFieldOptions,
        getTreeFieldPlaceholder,
    };

    const transformCategoryToTreeNode = (category: Category) => {
        const node = {
            id: category.id,
            key: category.id,
            label: category.name,
            children: children
                ? category.children.map(transformCategoryToTreeNode)
                : [],
        };
        return node;
    };

    useEffect(() => {
        ApiCategories.getCategories()
            .then((response) => {
                setCategoryTree(response.data.map(transformCategoryToTreeNode));
            })
            .catch((error) => {
                console.error(error);
            });
    }, []);

    useEffect(() => {
        if (extractionId) {
            ApiGeneratedExtractions.getExtraction(extractionId)
                .then((response) => {
                    setActiveQuery({
                        id_list: response.data.document_ids,
                        sort: { field: DocumentField.Category },
                    });
                })
                .catch((error) => {
                    console.error(error);
                });
        }
    }, [extractionId]);

    useEffect(() => {
        if (digitizationListId) {
            ApiDigitizationExtractions.getExtraction(digitizationListId)
                .then((response) => {
                    setActiveQuery({
                        id_list: response.data.document_ids,
                        sort: { field: DocumentField.Category },
                    });
                })
                .catch((error) => {
                    console.error(error);
                });
        }
    }, [digitizationListId]);

    useEffect(() => {
        if (categoryIds && categoryIds.length > 0) {
            setActiveQuery({
                search_group: SearchGroup.createCategoryIdSearch(categoryIds),
            });
        }
    }, [categoryIds]);

    return (
        <DocumentsSearchContext.Provider value={contextValue}>
            {children}
        </DocumentsSearchContext.Provider>
    );
};

export const useDocumentsSearch = (): DocumentsSearchContextProps => {
    const context = useContext(DocumentsSearchContext);

    if (!context) {
        throw new Error(
            "useDocumentsSearch must be used within a DocumentsSearchProvider"
        );
    }

    return context;
};
