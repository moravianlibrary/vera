import { useEffect, useState } from "react";
import { EsIndexSettings } from "./IndexSettings";
import {
    EsAggregation,
    EsFacets,
    EsQuery,
    EsRefinedFacet,
    EsSearchRequest,
    EsSearchResponse,
    buildFacetsRequest,
    buildResponseFacets,
    buildSearchRequest,
} from "./Search";

interface EsPageSizeOption {
    value: number;
    label: string;
    default?: boolean;
}

interface EsContextProps<T> {
    items: T[];
    numFound: number;
    facets: EsFacets;
    refresh: () => void;
    page: number;
    setPage: (page: number) => void;
    pageSizeOptions?: EsPageSizeOption[];
    pageSize: number;
    setPageSize: (pageSize: number) => void;
    query: EsQuery;
    refineFacet: (facet: string, value: string) => void;
    updateItem: (id: string, item: T) => void;
}

const DEFAULT_PAGE_SIZE_OPTIONS: EsPageSizeOption[] = [
    { value: 10, label: "10" },
    { value: 15, label: "15" },
    { value: 20, label: "20", default: true },
    { value: 25, label: "25" },
    { value: 50, label: "50" },
    { value: 100, label: "100" },
];

const useElasticsearch = <T extends { id: string }>(
    indexSettings: EsIndexSettings,
    search: (queryParams: EsSearchRequest) => Promise<EsSearchResponse<T>>,
    pageSizeOptions: EsPageSizeOption[] = DEFAULT_PAGE_SIZE_OPTIONS,
    defaultQuery: EsQuery = { bool: { must: { match_all: {} } } },
    onUpdateItem?: (id: string, item: T) => void
) => {
    const [items, setItems] = useState<T[]>([]);
    const [numFound, setNumFound] = useState(0);
    const [facets, setFacets] = useState<EsFacets>({});
    const [refinedFacets, setRefinedFacets] = useState<EsRefinedFacet>({});
    const [lastRefinedFacet, setLastRefinedFacet] = useState<string>(undefined);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [query, setQuery] = useState<EsQuery>(defaultQuery);
    const [searchRequest, setSearchRequest] = useState<EsSearchRequest>(
        buildSearchRequest(indexSettings, query, refinedFacets, page, pageSize)
    );

    const refresh = () => {
        search(searchRequest).then((response) => {
            setItems(response.hits.hits.map((hit) => hit._source));
            setNumFound(response.hits.total.value);
            setFacets(
                buildResponseFacets(response.aggregations || {}, refinedFacets)
            );
        });
    };

    const refineFacet = (facet: string, value: string) => {
        setRefinedFacets((prevFacets) => {
            const updatedFacets = { ...prevFacets };

            if (!updatedFacets[facet]) {
                updatedFacets[facet] = [];
            }

            if (updatedFacets[facet].includes(value)) {
                updatedFacets[facet] = updatedFacets[facet].filter(
                    (v) => v !== value
                );
            } else {
                updatedFacets[facet] = [...updatedFacets[facet], value];
            }
            setLastRefinedFacet(facet);

            return updatedFacets;
        });
    };

    const updateItem = (id: string, item: any) => {
        if (!onUpdateItem) {
            throw new Error(
                "onUpdateItem must be defined to use updateItem function"
            );
        }
        onUpdateItem(id, item);
    };

    useEffect(() => {
        const searchRequest = buildSearchRequest(
            indexSettings,
            query,
            refinedFacets,
            page,
            pageSize
        );
        if (lastRefinedFacet) {
            const facetRequest = buildFacetsRequest(
                indexSettings,
                query,
                refinedFacets,
                lastRefinedFacet
            );
            Promise.all([search(searchRequest), search(facetRequest)]).then(
                ([searchResponse, facetsResponse]) => {
                    searchResponse.aggregations[lastRefinedFacet] =
                        facetsResponse.aggregations[lastRefinedFacet];
                    setItems(
                        searchResponse.hits.hits.map((hit) => hit._source)
                    );
                    setNumFound(searchResponse.hits.total.value);
                    setFacets(
                        buildResponseFacets(
                            searchResponse.aggregations || {},
                            refinedFacets
                        )
                    );
                }
            );
        }
    }, [query, refinedFacets, lastRefinedFacet, page, pageSize]);

    useEffect(() => {
        refresh();
    }, [searchRequest]);

    return {
        items,
        numFound,
        facets,
        refresh,
        page,
        setPage,
        pageSizeOptions,
        pageSize,
        setPageSize,
        query,
        refineFacet,
        updateItem,
    };
};

export default useElasticsearch;
export type { EsContextProps };
