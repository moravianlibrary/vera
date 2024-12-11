import { EsIndexSettings, EsSortOrder } from "./IndexSettings";

interface EsQuery {
    bool?: {
        must?: Record<string, any> | Array<Record<string, any>>;
        filter?: Array<Record<string, any>>;
        should?: Array<Record<string, any>>;
        must_not?: Array<Record<string, any>>;
    };
    match?: Record<string, any>;
    term?: Record<string, any>;
}

interface EsTermsAggregation {
    field: string;
    size?: number;
    order?: {
        _key: "asc" | "desc";
    };
}

type EsAggregation =
    | { terms: EsTermsAggregation }
    | { stats: { field: string } };

interface EsSearchRequest {
    index?: string;
    _source: {
        includes: string[];
    };
    aggs?: Record<string, EsAggregation>;
    sort?: Array<Record<string, EsSortOrder>>;
    query: EsQuery;
    from?: number;
    size?: number;
}

interface EsFacetBucket {
    key: string;
    doc_count: number;
    isRefined?: boolean;
}

interface EsFacet {
    doc_count_error_upper_bound: number;
    sum_other_doc_count: number;
    buckets: EsFacetBucket[];
}

type EsFacets = Record<string, EsFacet>;

interface EsSearchResponse<T = unknown> {
    took: number;
    timed_out: boolean;
    _shards: {
        total: number;
        successful: number;
        skipped: number;
        failed: number;
    };
    hits: {
        total: {
            value: number;
            relation: "eq" | "gte";
        };
        max_score: number | null;
        hits: Array<{
            _index: string;
            _id: string;
            _score: number | null;
            _source: T;
        }>;
    };
    aggregations?: EsFacets;
}

interface EsSearchParams {
    index: string;
    query: EsQuery;
}

function buildSearchRequest(
    indexSettings: EsIndexSettings,
    query: EsQuery,
    refinedFacets: Record<string, string[]>,
    page: number,
    pageSize: number
) {
    console.log("INPUT", query);

    const currQuery = { ...query };
    const facetFilters = Object.entries(refinedFacets)
        .filter(([, values]) => values.length > 0)
        .map(([key, values]) =>
            values.length === 1
                ? { term: { [key]: values[0] } }
                : {
                      bool: {
                          should: values.map((value) => ({
                              term: { [key]: value },
                          })),
                      },
                  }
        );

    if (!currQuery.bool) {
        currQuery.bool = { filter: facetFilters, must: { match_all: {} } };
    } else if (!currQuery.bool.filter && facetFilters.length > 0) {
        currQuery.bool.filter = facetFilters;
    } else if (facetFilters.length > 0) {
        currQuery.bool.filter.concat(facetFilters);
    }

    return {
        _source: { includes: indexSettings.result_attributes },
        query,
        from: (page - 1) * pageSize,
        aggs: (indexSettings.facet_attributes || []).reduce((acc, facet) => {
            if (facet.type === "string") {
                acc[facet.field] = {
                    terms: { field: facet.field, order: facet.order },
                };
            } else if (facet.type === "numeric") {
                acc[facet.field] = {
                    terms: { field: facet.field, order: facet.order },
                };
                // acc[facet.field] = { stats: { field: facet.field } };
            }

            return acc;
        }, {} as Record<string, EsAggregation>),
        size: pageSize,
    };
}

export type {
    EsQuery,
    EsSearchRequest,
    EsAggregation,
    EsSearchResponse,
    EsSearchParams,
    EsFacetBucket,
    EsFacet,
    EsFacets,
};
export { buildSearchRequest };
