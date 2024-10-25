import { MutableRefObject, useEffect, useRef, useState } from "react";
import { ItemsPaginationProps } from "./PaginationInjector";
import {
    useHitsPerPage,
    useInstantSearch,
    usePagination,
} from "react-instantsearch";
import { EsQuery } from "../../adapters/ApiTasks";
import {
    stateToQuery,
    stateToRoute,
} from "../../data/factories/EsQueriesFactory";

interface EsItemsPaginationProps<T> extends ItemsPaginationProps<T> {
    uiState: any;
    updateItem: (id: string, item: T) => void;
    queryParams: MutableRefObject<EsQuery>;
    queryRoute: MutableRefObject<EsQuery>;
}

const useEsPagination = <T extends { id: string }>() => {
    const { uiState, results, refresh } = useInstantSearch();
    const { hits, hitsPerPage } = results;
    const { nbHits, currentRefinement, refine: setPage } = usePagination();
    const { refine: setPageSize } = useHitsPerPage({
        items: [
            { value: 10, label: "10" },
            { value: 15, label: "15" },
            { value: 20, label: "20", default: true },
            { value: 25, label: "25" },
            { value: 50, label: "50" },
            { value: 100, label: "100" },
        ],
    });

    const [items, setItems] = useState<T[]>([]);

    const queryParams = useRef<EsQuery>(stateToQuery(uiState));
    const queryRoute = useRef<EsQuery>(stateToRoute(uiState));

    useEffect(() => {
        setItems(hits);
    }, [hits]);

    useEffect(() => {
        const newQueryParams = stateToQuery(uiState);
        if (
            JSON.stringify(newQueryParams) !==
            JSON.stringify(queryParams.current)
        ) {
            queryParams.current = newQueryParams;
        }
        queryRoute.current = stateToRoute(uiState);
    }, [JSON.stringify(uiState)]);

    const updateItem = (id: string, item: any) => {
        setItems((prevItems) => {
            return prevItems.map((prevItem) => {
                if (prevItem.id === id) {
                    return item;
                }
                return prevItem;
            });
        });
    };

    return {
        items,
        numFound: nbHits,
        uiState,
        queryParams,
        queryRoute,
        refresh,
        updateItem,
        page: currentRefinement + 1,
        setPage: (page: number) => setPage(page - 1),
        pageSize: hitsPerPage,
        setPageSize: setPageSize,
    };
};

export default useEsPagination;
export type { EsItemsPaginationProps };
