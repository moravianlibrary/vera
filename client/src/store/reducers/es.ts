import type { EsQuery } from "../../models/api/requests/es_query";
import type { EsRequestAction, EsSessionState } from "../domains/es";

function weightedFields(
    fields: string[],
    weights: Record<string, number> | undefined
): string[] {
    return weights
        ? fields.map((f) => (weights[f] ? `${f}^${weights[f]}` : f))
        : fields;
}

function buildSearchQueries(
    value: string,
    fields: string[],
    phraseWeights?: Record<string, number>,
    prefixWeights?: Record<string, number>,
    fuzziness?: string,
    fuzzyWeights?: Record<string, number>
) {
    const phrase_query = {
        multi_match: {
            type: "phrase",
            fields: weightedFields(fields, phraseWeights),
            query: value,
        },
    };
    const bool_prefix_query = {
        multi_match: {
            type: "bool_prefix",
            fields: weightedFields(fields, prefixWeights),
            query: value,
        },
    };

    if (!fuzziness) {
        return [phrase_query, bool_prefix_query];
    }

    return [
        phrase_query,
        bool_prefix_query,
        {
            multi_match: {
                fuzziness: fuzziness,
                fields: weightedFields(fields, fuzzyWeights),
                query: value,
            },
        },
    ];
}

function isQueryBoolEmpty(query: EsQuery) {
    const { bool } = query;
    return (
        (!bool.must || bool.must.length === 0) &&
        (!bool.should || bool.should.length === 0) &&
        (!bool.filter || bool.filter.length === 0) &&
        (!bool.must_not || bool.must_not.length === 0)
    );
}

function toggleTerm(query: EsQuery, field: string, bucketKey: string) {
    const newQuery = { ...query };
    if (!newQuery.bool) {
        newQuery.bool = {};
    }
    if (!newQuery.bool.filter) {
        newQuery.bool.filter = [];
    }

    const existingTermIndex = newQuery.bool.filter.findIndex(
        (clause) =>
            "term" in clause &&
            Object.keys(clause.term)[0] === field &&
            clause.term[field] === bucketKey
    );

    if (existingTermIndex >= 0) {
        // Remove existing term filter
        newQuery.bool.filter.splice(existingTermIndex, 1);
    } else {
        // Add new term filter
        newQuery.bool.filter.push({ term: { [field]: bucketKey } });
    }

    if (newQuery.bool.filter.length === 0) {
        newQuery.bool.filter = undefined;
    }

    if (isQueryBoolEmpty(newQuery)) {
        return { match_all: {} };
    }

    return newQuery;
}

export function requestReducer(
    state: EsSessionState,
    action: EsRequestAction
): EsSessionState {
    switch (action.type) {
        case "setData":
            return {
                ...state,
                hits: action.data?.hits.hits,
                totalItems: action.data?.hits.total.value || 0,
                aggregations: action.data?.aggregations,
            };
        case "setPaginationParams":
            return {
                ...state,
                page: action.page,
                perPage: action.perPage,
                requests: state.requests.map((req, index) =>
                    index === 0
                        ? {
                              ...req,
                              from: (action.page - 1) * action.perPage,
                              size: action.perPage,
                          }
                        : req
                ),
            };
        case "setSearchTerm":
            return {
                ...state,
                searchTerm: action.value,
            };
        case "clearSearch":
            return {
                ...state,
                searchTerm: undefined,
                // requests: [],
            };
        // const newQuery = {
        //     ...state.request.query,
        // };
        // return {
        //     ...state,
        //     searchTerm: "",
        //     request: {
        //         ...state.request,
        //         query: isQueryBoolEmpty(newQuery)
        //             ? { match_all: {} }
        //             : newQuery,
        //     },
        // };
        case "submitSearch":
        // if (!state.searchTerm) {
        //     const newQuery = {
        //         ...state.request.query,
        //         bool: {
        //             ...state.request.query.bool,
        //             must: undefined,
        //         },
        //     };
        //     return {
        //         ...state,
        //         request: {
        //             ...state.request,
        //             query: isQueryBoolEmpty(newQuery)
        //                 ? { match_all: {} }
        //                 : newQuery,
        //         },
        //     };
        // }
        // return {
        //     ...state,
        //     request: {
        //         ...state.request,
        //         query: {
        //             bool: {
        //                 ...state.request.query.bool,
        //                 must: {
        //                     dis_max: {
        //                         queries: buildSearchQueries(
        //                             state.searchTerm,
        //                             action.config.fields,
        //                             action.config.phraseBoosts,
        //                             action.config.prefixBoosts,
        //                             state.searchFuzziness,
        //                             action.config.fuzzyBoosts
        //                         ),
        //                         tie_breaker: 0.0,
        //                     },
        //                 },
        //             },
        //         },
        //     },
        // };
        case "toggleTerm":
            const currentTerms =
                state.filterStates?.[action.field]?.selected || [];
        case "clearFilters":
            return {
                ...state,
                filterStates: {},
            };
        case "setSortBy":
            return {
                ...state,
                sortBy: action.option,
                request: {
                    ...state.request,
                    sort: action.option.value,
                },
            };
        case "setPageIds":
            return {
                ...state,
                pageIds: action.ids,
                selectedIds: new Set<string>(
                    state.isAllSelected ? action.ids : []
                ),
            };
        case "toggleSelection":
            const newSelectedIds = new Set(state.selectedIds);
            if (newSelectedIds.has(action.id)) {
                newSelectedIds.delete(action.id);
            } else {
                newSelectedIds.add(action.id);
            }
            return {
                ...state,
                selectedIds: newSelectedIds,
                isAllSelected: false,
            };
        case "clearSelection":
            return {
                ...state,
                selectedIds: new Set<string>(),
                isAllSelected: false,
            };
        case "selectPage":
            return {
                ...state,
                selectedIds: new Set(state.pageIds),
                isAllSelected: false,
            };
        case "selectAll":
            return {
                ...state,
                selectedIds: new Set<string>(state.pageIds),
                isAllSelected: true,
            };
        default:
            return state;
    }
}
