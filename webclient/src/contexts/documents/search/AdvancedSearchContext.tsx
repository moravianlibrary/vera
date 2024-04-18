import React, { ReactNode, createContext, useContext, useState } from "react";
import { SearchGroup } from "./SearchNodes";
import { useDocumentsQuery } from "./DocumentsQueryContext";

interface AdvancedSearchContextProps {
    rootSearchGroup: SearchGroup;
    handleApplyFilter: () => void;
    handleSaveFilter: () => void;
    handleClearFilter: () => void;
}

interface AdvancedSearchProviderProps {
    children: ReactNode;
}

const AdvancedSearchContext = createContext<
    AdvancedSearchContextProps | undefined
>(undefined);

export const AdvancedSearchProvider: React.FC<AdvancedSearchProviderProps> = ({
    children,
}) => {
    const { searchBySearchGroup } = useDocumentsQuery();

    const [rootSearchGroup, setRootSearchGroup] = useState<SearchGroup>(
        SearchGroup.init()
    );

    // TODO: validate rootSearchGroup
    const handleApplyFilter = () => {
        searchBySearchGroup(rootSearchGroup);
    };

    const handleSaveFilter = () => {
        localStorage.setItem(
            "advanced_search",
            JSON.stringify(rootSearchGroup)
        );
    };

    const handleClearFilter = () => {
        setRootSearchGroup(SearchGroup.createEmpty());
    };

    const contextValue: AdvancedSearchContextProps = {
        rootSearchGroup,
        handleApplyFilter,
        handleSaveFilter,
        handleClearFilter,
    };

    return (
        <AdvancedSearchContext.Provider value={contextValue}>
            {children}
        </AdvancedSearchContext.Provider>
    );
};

export const useAdvancedSearch = (): AdvancedSearchContextProps => {
    const context = useContext(AdvancedSearchContext);

    if (!context) {
        throw new Error(
            "useAdvancedSearch must be used within a AdvancedSearchProvider"
        );
    }

    return context;
};
