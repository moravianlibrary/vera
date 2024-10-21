import { ItemsPaginationProps } from "./PaginationInjector";
import {
    useHitsPerPage,
    useInstantSearch,
    usePagination,
} from "react-instantsearch";
import { EsQuery } from "../../adapters/ApiTasks";
import { useMemo, useState } from "react";

interface EsItemsPaginationProps<T> extends ItemsPaginationProps<T> {
    uiState: any;
    queryParams: EsQuery;
    queryRoute: EsQuery;
}

const useEsPagination = (
    stateToQueryParams: (uiState: any) => EsQuery,
    stateToQueryRoute: (uiState: any) => EsQuery
) => {
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
    const memoizedQueryParams = useMemo(
        () => stateToQueryParams(uiState),
        [uiState, stateToQueryParams]
    );
    const memoizedQueryRoute = useMemo(
        () => stateToQueryRoute(uiState),
        [uiState, stateToQueryRoute]
    );

    const [queryParams, setQueryParams] =
        useState<EsQuery>(memoizedQueryParams);
    const [queryRoute, setQueryRoute] = useState<EsQuery>(memoizedQueryRoute);

    // useEffect(() => {
    //     const newQueryParams = stateToQueryParams(uiState);
    //     if (JSON.stringify(newQueryParams) !== JSON.stringify(queryParams)) {
    //         setQueryParams(newQueryParams);
    //     }

    //     const newQueryRoute = stateToQueryRoute(uiState);
    //     if (JSON.stringify(newQueryRoute) !== JSON.stringify(queryRoute)) {
    //         setQueryRoute(newQueryRoute);
    //     }
    // }, [uiState]);

    return {
        items: hits,
        numFound: nbHits,
        uiState,
        queryParams,
        queryRoute,
        refresh: refresh,
        page: currentRefinement + 1,
        setPage: (page: number) => setPage(page - 1),
        pageSize: hitsPerPage,
        setPageSize: setPageSize,
    };
};

export default useEsPagination;
export type { EsItemsPaginationProps };
