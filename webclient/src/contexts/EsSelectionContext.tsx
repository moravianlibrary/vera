import {
    DataTableSelectionMultipleChangeEvent,
    DataTableValueArray,
} from "primereact/datatable";
import React, { createContext, useContext, useState, ReactNode } from "react";
import {
    useHitsPerPage,
    useInstantSearch,
    usePagination,
} from "react-instantsearch";

interface EsSelectionContextProps {
    items: any[];
    numFound: number;
    page: number;
    setPage: (page: number) => void;
    pageSizeOptions: number[];
    pageSize: number;
    setPageSize: (pageSize: number) => void;

    selectedIds: string[];
    numSelected: number;
    currentPageSelected: any[];
    handleDataTableSelectionChange: (
        event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>
    ) => void;
    areAllItemsSelected: boolean;
    setAreAllItemsSelected: (value: boolean) => void;
    cancelSelection: () => void;
}

const EsSelectionContext = createContext<EsSelectionContextProps | undefined>(
    undefined
);

interface EsSelectionProviderProps {
    children: ReactNode;
}

export const EsSelectionProvider: React.FC<EsSelectionProviderProps> = ({
    children,
}) => {
    const { results } = useInstantSearch();
    const { hits: items, hitsPerPage: pageSize } = results;
    const {
        nbHits: numFound,
        currentRefinement: page,
        refine: setPage,
    } = usePagination();
    const { items: pageSizeOptionsEs, refine: setPageSize } = useHitsPerPage({
        items: [
            { value: 10, label: "10" },
            { value: 15, label: "15" },
            { value: 20, label: "20", default: true },
            { value: 25, label: "25" },
            { value: 50, label: "50" },
            { value: 100, label: "100" },
        ],
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [currentPageSelected, setCurrentPageSelected] = useState<any[]>([]);
    const [numSelected, setNumSelected] = useState<number>(0);
    const [areAllItemsSelected, setAreAllItemsSelected] =
        useState<boolean>(false);

    const handleSetSelectedItems = (selectedItems: any[]) => {
        // setSelectedItems(selectedItems);
        // setNumSelected(selectedItems.length);
        // setAreAllItemsSelected(selectedItems.length === nbHits);
    };

    const handleDataTableSelectionChange = (
        event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>
    ) => {
        console.log(event.value);

        // if (event.value.length === 0) {
        //     setSelectedItems(
        //         selectedItems.filter((item) => !results.hits.includes(item))
        //     );
        // } else {
        //     setSelectedItems(event.value);
        // }
    };

    const handleSetAreAllItemsSelected = (value: boolean) => {
        // setNumSelected(value ? nbHits : selectedItems.length);
        // setAreAllItemsSelected(value);
    };

    const cancelSelection = () => {
        // setSelectedItems([]);
        // setAreAllItemsSelected(false);
    };

    const contextValue: EsSelectionContextProps = {
        items,
        numFound,
        page,
        setPage,
        pageSizeOptions: pageSizeOptionsEs.map((o) => o.value),
        pageSize,
        setPageSize,

        selectedIds,
        numSelected,
        currentPageSelected,
        handleDataTableSelectionChange,
        areAllItemsSelected,
        setAreAllItemsSelected: handleSetAreAllItemsSelected,
        cancelSelection,
    };

    return (
        <EsSelectionContext.Provider value={contextValue}>
            {children}
        </EsSelectionContext.Provider>
    );
};

export const useEsSelection = (): EsSelectionContextProps => {
    const context = useContext(EsSelectionContext);

    if (!context) {
        throw new Error(
            "useEsSelection must be used within a EsSelectionProvider"
        );
    }

    return context;
};
