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

interface DocumentsSearchContextProps {
    rootSearchNode: SearchGroup | undefined;
    activeQuery: DocumentsQuery | undefined;
    searchPhrase: string;
    activeDigitizationList: number | null;
    setActiveDigitizationList: (digitizationListId: number | null) => void;
    setSearchPhrase: (searchPhrase: string) => void;
    searchByPhrase: () => void;
    handleApplyFilter: () => void;
    handleCancelFilter: () => void;
    handleSaveFilter: () => void;
    handleClearFilter: () => void;
    getTreeFieldOptions: (enumField: DocumentField) => TreeNode[];
    getTreeFieldPlaceholder: (enumField: DocumentField) => string;

    getActiveQuery: () => DocumentsQuery | null;
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
    const [activeDigitizationList, setActiveDigitizationList] = useState<
        number | null
    >(null);
    const [searchPhrase, setSearchPhrase] = useState<string>("");
    const [triggerSearchTimer, setTriggerSearchTimer] = useState<
        NodeJS.Timeout | undefined
    >(undefined);

    const [categoryTree, setCategoryTree] = useState<TreeNode[]>([]);

    const searchByPhrase = () => {
        if (searchPhrase !== "") {
            setActiveQuery({
                search_phrase: searchPhrase,
            });
        } else {
            setActiveQuery(undefined);
        }
        setActiveDigitizationList(null);
    };

    useEffect(() => {
        if (searchPhrase === "" && triggerSearchTimer === undefined) {
            return;
        }
        clearTimeout(triggerSearchTimer);
        setTriggerSearchTimer(
            setTimeout(() => {
                searchByPhrase();
            }, 1000)
        );
    }, [searchPhrase]);

    const handleApplyFilter = () => {
        setActiveQuery({ search_group: rootSearchNode });
        setActiveDigitizationList(null);
    };

    const handleCancelFilter = () => {
        setActiveQuery(undefined);
        setSearchPhrase("");
        setActiveDigitizationList(null);
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

    const getActiveQuery = (): DocumentsQuery | null => {
        if (activeQuery) {
            return activeQuery;
        }
        return null;
    };

    const contextValue: DocumentsSearchContextProps = {
        rootSearchNode,
        activeQuery,
        searchPhrase,
        activeDigitizationList,
        setActiveDigitizationList,
        setSearchPhrase,
        searchByPhrase,
        handleApplyFilter,
        handleCancelFilter,
        handleSaveFilter,
        handleClearFilter,
        getTreeFieldOptions,
        getTreeFieldPlaceholder,
        getActiveQuery,
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
        if (activeDigitizationList) {
            ApiDigitizationExtractions.getExtraction(activeDigitizationList)
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
    }, [activeDigitizationList]);

    useEffect(() => {
        if (digitizationListId) {
            setActiveDigitizationList(digitizationListId);
        } else {
            setActiveDigitizationList(null);
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
