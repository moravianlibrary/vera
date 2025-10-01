import type { EsRequest, EsSortBy } from "../../../models/api/requests/es";
import type {
    TableColumnConfig,
    TableColumnState,
} from "../../../models/config";
import type { EsFilterConfig } from "../../../models/es";
import type { EsFilterState, EsFilterStates } from "../../../models/ui/es";
import type { EsSearchConfig } from "./state";

function weightedFields(
    fields: string[],
    weights: Record<string, number> | undefined
): string[] {
    return weights
        ? fields.map((f) => (weights[f] ? `${f}^${weights[f]}` : f))
        : fields;
}

function buildSearchQueries(
    config: EsSearchConfig,
    term: string,
    fuzziness?: string
) {
    const phrase_query = {
        multi_match: {
            type: "phrase",
            fields: weightedFields(config.fields, config.phraseBoosts),
            query: term,
        },
    };
    const bool_prefix_query = {
        multi_match: {
            type: "bool_prefix",
            fields: weightedFields(config.fields, config.prefixBoosts),
            query: term,
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
                fields: weightedFields(config.fields, config.fuzzyBoosts),
                query: term,
            },
        },
    ];
}

function buildFilterQuery(config: EsFilterConfig, state: EsFilterState) {
    switch (config.type) {
        case "terms":
            return { terms: { [config.field]: state } };
        case "range":
            return {
                range: {
                    [config.field]: {
                        gte: (state as any).from,
                        lte: (state as any).to,
                    },
                },
            };
        case "date-range":
            return {
                range: {
                    [config.field]: {
                        gte: (state as any).from,
                        lte: (state as any).to,
                        format: "yyyy-MM-dd||yyyy-MM-dd'T'HH:mm:ss||epoch_millis",
                    },
                },
            };
        case "search":
            return {
                match: {
                    [config.field]: state as unknown as string,
                },
            };
    }
}

function buildAggs(configs: EsFilterConfig[]): Record<string, any> {
    return configs.reduce((acc, filter) => {
        if (filter.type === "terms") {
            acc[filter.field] = { terms: { field: filter.field } };
        } else if (filter.type === "range") {
            acc[filter.field] = {
                range: {
                    field: filter.field,
                    ranges: [{ from: filter.min, to: filter.max }],
                },
            };
        } else if (filter.type === "date-range") {
            acc[filter.field] = {
                date_range: {
                    field: filter.field,
                    // ranges: [{ min: filter., max: filter.max }],
                },
            };
        }
        return acc;
    }, {} as Record<string, any>);
}

function buildFieldIncludes(
    columnConfigs: TableColumnConfig[],
    columnStates: Record<string, TableColumnState>
): string[] {
    return columnConfigs
        .filter((col) => columnStates[col.key]?.visible)
        .map((col) => col.fields || [col.key])
        .flat();
}

export function buildRequests(
    columnConfigs: TableColumnConfig[],
    columnStates: Record<string, TableColumnState>,
    page: number,
    perPage: number,
    searchConfig: EsSearchConfig,
    searchTerm: string,
    searchFuzziness: string | undefined,
    filterConfigs: EsFilterConfig[],
    filterStates: EsFilterStates | undefined,
    sortBy: EsSortBy
): EsRequest[] {
    const searchQueries = searchTerm
        ? buildSearchQueries(searchConfig, searchTerm, searchFuzziness)
        : [];
    const filterQueries = filterConfigs
        .filter((config) => filterStates && filterStates[config.field])
        .reduce((acc, config) => {
            acc[config.field] = buildFilterQuery(
                config,
                filterStates![config.field]
            );
            return acc;
        }, {} as Record<string, any>);
    const aggs = buildAggs(filterConfigs);

    const hitsRequest: EsRequest = {
        query: { match_all: {} },
        from: (page - 1) * perPage,
        size: perPage,
        sort: sortBy,
        _source: {
            includes: buildFieldIncludes(columnConfigs, columnStates),
        },
        aggs: aggs,
    };
    return [hitsRequest];
}
