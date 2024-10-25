import {
    DataTableRowEvent,
    DataTableSelectionMultipleChangeEvent,
    DataTableValueArray,
} from "primereact/datatable";
import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import {
    useHitsPerPage,
    useInstantSearch,
    usePagination,
} from "react-instantsearch";
import { stateToRoute } from "../data/factories/EsQueriesFactory";
import { EsQuery } from "../adapters/ApiTasks";

interface EsDataTableContextProps {
    items: any[];
    numFound: number;
    queryParams: EsQuery;
    refresh: () => void;
    updateItem: (id: string, item: any) => void;

    page: number;
    setPage: (page: number) => void;
    pageSizeOptions: number[];
    pageSize: number;
    setPageSize: (pageSize: number) => void;

    numSelected: number;
    currentPageSelected: any[];
    handleDataTableSelectionChange: (
        event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>
    ) => void;
    areAllItemsSelected: boolean;
    setAreAllItemsSelected: (value: boolean) => void;
    cancelSelection: () => void;
    selectedQuery: any;

    expandedRows: any[];
    handleRowExpand: (event: DataTableRowEvent) => void;
    handleRowCollapse: (event: DataTableRowEvent) => void;
}

const EsDataTableContext = createContext<EsDataTableContextProps | undefined>(
    undefined
);

interface EsDataTableProviderProps {
    children: ReactNode;
}

export const EsDataTableProvider: React.FC<EsDataTableProviderProps> = ({
    children,
}) => {
    const { uiState, results, refresh } = useInstantSearch();
    const { hits, hitsPerPage: pageSize } = results;
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

    const [items, setItems] = useState<any[]>([]);
    const [queryParams, setQueryParams] = useState<EsQuery>({
        index_name: "catalog_records",
    });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPageSelected, setCurrentPageSelected] = useState<any[]>([]);
    const [numSelected, setNumSelected] = useState<number>(0);
    const [areAllItemsSelected, setAreAllItemsSelected] =
        useState<boolean>(false);
    const [selectedQuery, setSelectedQuery] = useState<any>({});
    const [expandedRows, setExpandedRows] = useState<any[]>([]);

    const updateItem = (id: string, item: any) => {
        // const prevItem = items.find((prevItem) => prevItem.id === id);
        // prevItem && Object.assign(prevItem, item);
        setItems((prevItems) => {
            return prevItems.map((prevItem) => {
                if (prevItem.id === id) {
                    return item;
                }
                return prevItem;
            });
        });
    };

    const handleDataTableSelectionChange = (
        event: DataTableSelectionMultipleChangeEvent<DataTableValueArray>
    ) => {
        const currentSelectedIds = new Set(event.value.map((item) => item.id));
        const currentPageIds = new Set(items.map((item) => item.id));

        setSelectedIds((prevSelectedIds) => {
            const updatedSelectedIds = new Set(prevSelectedIds);
            currentPageIds.forEach((id) => {
                if (!currentSelectedIds.has(id)) {
                    updatedSelectedIds.delete(id);
                }
            });
            currentSelectedIds.forEach((id) => updatedSelectedIds.add(id));

            setNumSelected(updatedSelectedIds.size);

            setAreAllItemsSelected(updatedSelectedIds.size === numFound);

            setSelectedQuery({ id: Array.from(updatedSelectedIds).join(",") });

            return updatedSelectedIds;
        });
    };

    const handleSetAreAllItemsSelected = (value: boolean) => {
        setAreAllItemsSelected(value);
        setNumSelected(value ? numFound : selectedIds.size);
        setSelectedQuery(stateToRoute(uiState));
    };

    const cancelSelection = () => {
        setSelectedIds(new Set());
        setNumSelected(0);
        setAreAllItemsSelected(false);
        setSelectedQuery({});
    };

    const handleRefresh = () => {
        cancelSelection();
        refresh();
    };

    const handleRowExpand = (e: DataTableRowEvent) => {
        setExpandedRows([...expandedRows, e.data]);
    };

    const handleRowCollapse = (e: DataTableRowEvent) => {
        setExpandedRows(expandedRows.filter((row) => row.id !== e.data.id));
    };

    useEffect(() => {
        // setItems(hits);
        // setQueryParams(
        //     stateToRoute("catalog_records", booleanAttributes, uiState)
        // );
    }, [hits]);

    useEffect(() => {
        if (areAllItemsSelected) {
            setCurrentPageSelected(items);
        } else {
            setCurrentPageSelected(
                items.filter((item) => selectedIds.has(item.id))
            );
        }
    }, [items, selectedIds, areAllItemsSelected]);

    useEffect(() => {
        // cancelSelection();
    }, [uiState]);

    const contextValue: EsDataTableContextProps = {
        items,
        numFound,
        queryParams,
        refresh: handleRefresh,
        updateItem,

        page: page + 1,
        setPage: (page) => setPage(page - 1),
        pageSizeOptions: pageSizeOptionsEs.map((o) => o.value),
        pageSize,
        setPageSize,

        numSelected,
        currentPageSelected,
        handleDataTableSelectionChange,
        areAllItemsSelected,
        setAreAllItemsSelected: handleSetAreAllItemsSelected,
        cancelSelection,
        selectedQuery,

        expandedRows,
        handleRowExpand,
        handleRowCollapse,
    };

    return (
        <EsDataTableContext.Provider value={contextValue}>
            {children}
        </EsDataTableContext.Provider>
    );
};

export const useEsDataTable = (): EsDataTableContextProps => {
    const context = useContext(EsDataTableContext);

    if (!context) {
        throw new Error(
            "useEsDataTable must be used within a EsDataTableProvider"
        );
    }

    return context;
};
