import type { EsPageState, EsRequestAction } from "../domains/es";

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

export function requestReducer(
    state: EsPageState,
    action: EsRequestAction
): EsPageState {
    switch (action.type) {
        case "set-search-value":
            return {
                ...state,
                searchInput: action.value,
            };

        case "submit-search":
            return {
                ...state,
                request: {
                    ...state.request,
                    query: {
                        bool: {
                            ...state.request.query.bool,
                            must: {
                                dis_max: {
                                    queries: buildSearchQueries(
                                        action.value,
                                        action.fields,
                                        action.phraseWeights,
                                        action.prefixWeights,
                                        action.fuzziness,
                                        action.fuzzyWeights
                                    ),
                                    tie_breaker: 0.0,
                                },
                            },
                        },
                    },
                },
            };

        case "clear-search":
            return {
                ...state,
                query: {
                    ...state.query,
                    bool: {
                        ...state.query.bool,
                        must: undefined,
                    },
                },
            };

        default:
            return state;
    }
}
