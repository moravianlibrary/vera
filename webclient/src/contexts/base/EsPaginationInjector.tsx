import React, { ReactNode } from "react";
import { ItemsPaginationProps } from "./PaginationInjector";
import {
    useHitsPerPage,
    useInstantSearch,
    usePagination,
} from "react-instantsearch";
import { EsQuery } from "../../adapters/ApiTasks";

interface EsItemsPaginationProps<T> extends ItemsPaginationProps<T> {
    queryParams: EsQuery;
}

const withEsPagination = <T,>(
    WrappedComponent: React.ComponentType<
        EsItemsPaginationProps<T> & { children?: ReactNode }
    >,
    stateToQueryParams: (uiState: any) => EsQuery
) => {
    return (
        props: Omit<EsItemsPaginationProps<T>, keyof EsItemsPaginationProps<T>>
    ) => {
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

        return (
            <WrappedComponent
                {...(props as any)}
                items={hits}
                numFound={nbHits}
                queryParams={stateToQueryParams(uiState)}
                refresh={refresh}
                page={currentRefinement + 1}
                setPage={(page) => setPage(page - 1)}
                pageSize={hitsPerPage}
                setPageSize={setPageSize}
            />
        );
    };
};

export default withEsPagination;
export type { EsItemsPaginationProps };
