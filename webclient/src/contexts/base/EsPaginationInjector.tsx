import { ItemsPaginationProps } from "./PaginationInjector";
import {
    useHitsPerPage,
    useInstantSearch,
    usePagination,
} from "react-instantsearch";
import { EsQuery } from "../../adapters/ApiTasks";
import { useMemo } from "react";

interface EsItemsPaginationProps<T> extends ItemsPaginationProps<T> {
    queryParams: EsQuery;
}

const useEsPagination = (stateToQueryParams: (uiState: any) => EsQuery) => {
    const { uiState, results, refresh } = useInstantSearch();
    const { hits, hitsPerPage } = results;
    const { nbHits, currentRefinement, refine: setPage } = usePagination();
    const { items: pageSizeOptions, refine: setPageSize } = useHitsPerPage({
        items: [
            { value: 10, label: "10" },
            { value: 15, label: "15" },
            { value: 20, label: "20", default: true },
            { value: 25, label: "25" },
            { value: 50, label: "50" },
            { value: 100, label: "100" },
        ],
    });
    const queryParams = useMemo(() => stateToQueryParams(uiState), [uiState]);

    return {
        items: hits,
        numFound: nbHits,
        queryParams: queryParams,
        refresh: refresh,
        page: currentRefinement + 1,
        setPage: (page: number) => setPage(page - 1),
        pageSize: hitsPerPage,
        setPageSize: setPageSize,
    };
};

export default useEsPagination;
export type { EsItemsPaginationProps };
