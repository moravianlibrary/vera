import {
    EsFacetAttribute,
    EsIndexSettings,
    EsSortOrder,
} from "./IndexSettings";

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
    | { stats: { field: string } }
    | { composite: any }
    | { multi_terms: any }
    | { nested: any; aggs: any };

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

type EsRefinedFacet = Record<string, string[]>;

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

function buildRequest(
    indexSettings: EsIndexSettings,
    page: number,
    pageSize: number,
    refinedFacets?: Record<string, string[]>,
    searchQuery?: string,
    searchExact?: boolean,
    facetAttributes?: EsFacetAttribute[]
) {
    const query: EsQuery = { bool: {} };

    // Add the `must` clause if there is a search query
    if (searchQuery && indexSettings.search_attributes?.length > 0) {
        const searchFields = indexSettings.search_attributes.map((attr) =>
            typeof attr === "string" ? attr : `${attr.field}^${attr.weight}`
        );

        query.bool.must = searchExact
            ? [
                  {
                      bool: {
                          should: searchFields.map((field) => ({
                              term: { [field]: searchQuery },
                          })),
                          minimum_should_match: 1,
                      },
                  },
              ]
            : [
                  {
                      multi_match: {
                          query: searchQuery,
                          fields: searchFields,
                          fuzziness: "AUTO",
                      },
                  },
              ];
    }

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
                          minimum_should_match: 1,
                      },
                  }
        );

    // Add the `filter` clause if there are facet filters
    if (facetFilters.length > 0) {
        query.bool.filter = facetFilters;
    }

    // Add a `match_all` clause if no `must` clause is defined
    if (!query.bool.must) {
        query.bool.must = [{ match_all: {} }];
    }

    // Build the aggregation section
    const aggs = (facetAttributes || []).reduce((acc, facet) => {
        if (facet.type === "string") {
            acc[facet.field] = {
                terms: { field: facet.field, order: facet.order },
            };
        } else if (facet.type === "numeric") {
            acc[facet.field] = {
                terms: { field: facet.field, order: facet.order },
            };
        } else if (facet.type === "nested") {
            const fieldSplit = facet.field.split(".");
            if (fieldSplit.length !== 2) {
                throw new Error(
                    "Nested fields must be in the form of `parent.nested_field`"
                );
            }
            acc[facet.field] = {
                nested: {
                    path: fieldSplit[0],
                },
                aggs: {
                    [fieldSplit[1]]: {
                        terms: {
                            field: facet.field,
                            size: facet.limit,
                        },
                    },
                },
            };
        } else if (facet.type === "object") {
            acc[`${facet.field}_object`] = {
                nested: {
                    path: facet.field,
                },
                aggs: {
                    categories: {
                        composite: {
                            size: facet.limit,
                            sources: facet.attributes.map((attr) => ({
                                [attr]: {
                                    terms: {
                                        field: `${facet.field}.${attr}`,
                                    },
                                },
                            })),
                        },
                    },
                },
            };
        }
        return acc;
    }, {} as Record<string, EsAggregation>);

    return {
        _source: { includes: indexSettings.result_attributes },
        from: (page - 1) * pageSize,
        size: pageSize,
        query,
        aggs,
    };
}

function buildSearchRequest(
    indexSettings: EsIndexSettings,
    page: number,
    pageSize: number,
    refinedFacets?: Record<string, string[]>,
    searchQuery?: string,
    searchExact?: boolean
) {
    return buildRequest(
        indexSettings,
        page,
        pageSize,
        refinedFacets,
        searchQuery,
        searchExact,
        indexSettings.facet_attributes.filter((f) => !refinedFacets[f.field])
    );
}

function buildFacetsRequest(
    indexSettings: EsIndexSettings,
    refinedFacets: Record<string, string[]>,
    lastRefinedFacet: string,
    searchQuery?: string,
    searchExact?: boolean
) {
    const { [lastRefinedFacet]: _, ...facetsWithoutLast } = refinedFacets;
    return buildRequest(
        indexSettings,
        0,
        0,
        facetsWithoutLast,
        searchQuery,
        searchExact,
        indexSettings.facet_attributes.filter(
            (f) => f.field === lastRefinedFacet
        )
    );
}

function buildResponseFacets(
    responseAggregations: EsFacets,
    refinedFacets: EsRefinedFacet
) {
    return Object.entries(responseAggregations).reduce(
        (acc, [facetName, facetData]) => {
            const refinedKeys = refinedFacets[facetName] || [];

            if (!facetData.buckets) return acc;
            acc[facetName] = {
                ...facetData,
                buckets: facetData.buckets.map((bucket) => ({
                    ...bucket,
                    isRefined: refinedKeys.includes(bucket.key),
                })),
            };

            return acc;
        },
        {} as EsFacets
    );
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
    EsRefinedFacet,
};
export { buildSearchRequest, buildFacetsRequest, buildResponseFacets };
