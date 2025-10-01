import type { EsRequest } from "../../../models/api/requests/es";
import type { EsHit } from "../../../models/api/responses/es";
import type { EsAggregation } from "../../../models/api/responses/es_aggregations";
import type {
    TableColumnConfig,
    TableColumnState,
} from "../../../models/config";
import type { EsDocumentResponse } from "../../../models/document";
import type { EsFilterConfig } from "../../../models/es";
import type { EsSortOption } from "../../../models/ui/config";
import type { EsFilterState } from "../../../models/ui/es";

export interface EsUiPreferences {
    // Columns
    columnStates: Record<string, TableColumnState>;
    // Pagination
    perPage: number;
    // Sorting
    sortBy: string;
}

export interface EsQueryParams {
    // Pagination
    page?: number;
    perPage: number;
    // Search
    searchTerm?: string;
    searchFuzziness?: string;
    // Filter
    filterStates?: Record<string, EsFilterState>;
    // Sorting
    sortBy: string;
}

export interface EsSessionState {
    // Requests queue
    requests: EsRequest[];
    // Results
    hits?: Array<EsHit<any>>;
    totalItems?: number;
    aggregations?: Record<string, EsAggregation>;
    pageIds?: string[];
    // Columns
    columnStates: Record<string, TableColumnState>;
    // Pagination
    page: number;
    perPage: number;
    // Search
    searchConfig: EsSearchConfig;
    searchTerm?: string;
    searchFuzziness?: string;
    // Filter
    filterConfigs: EsFilterConfig[];
    filterStates?: Record<string, EsFilterState>;
    // Sorting
    sortBy: EsSortOption;
    // Selection
    selectedIds: Set<string>;
    isAllSelected: boolean;
}

export interface EsSearchConfig {
    fields: string[];
    phraseBoosts?: Record<string, number>;
    prefixBoosts?: Record<string, number>;
    fuzzyBoosts?: Record<string, number>;
}

export type EsRequestAction =
    | { type: "setData"; data?: EsDocumentResponse }
    | { type: "setPaginationParams"; page: number; perPage: number }
    | { type: "setSearchTerm"; value: string }
    | { type: "submitSearch"; config: EsSearchConfig }
    | { type: "clearSearch" }
    | { type: "toggleTerm"; field: string; bucketKey: string }
    | { type: "setRange"; field: string; from?: number; to?: number }
    | { type: "setDateRange"; field: string; from?: string; to?: string }
    | { type: "setFieldQuery"; field: string; query: string }
    | { type: "clearFilters"; field?: string }
    | { type: "setSortBy"; option: EsSortOption }
    | { type: "setPageIds"; ids: string[] }
    | { type: "toggleSelection"; id: string }
    | { type: "clearSelection" }
    | { type: "selectPage" }
    | { type: "selectAll" };

export function initEsSessionState(
    columnConfigs: TableColumnConfig[],
    perPageDefault: number,
    searchConfig: EsSearchConfig,
    filterConfigs: EsFilterConfig[],
    sortByOptions: EsSortOption[],
    uiPreferences?: EsUiPreferences,
    queryParams?: EsQueryParams
): EsSessionState {
    return {
        requests: [
            {
                query: { match_all: {} },
                from: 0,
                size: 10,
                aggs: filterConfigs.reduce((acc, filter) => {
                    if (filter.type === "terms") {
                        acc[filter.field] = { terms: { field: filter.field } };
                    } else if (filter.type === "range") {
                        acc[filter.field] = {
                            range: {
                                field: filter.field,
                                ranges: [{ min: filter.min, max: filter.max }],
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
                }, {} as Record<string, any>),
                sort: sortByOptions[0].value,
            },
        ],
        // columnConfigs,
        columnStates:
            uiPreferences?.columnStates ||
            columnConfigs.reduce((acc, col, index) => {
                acc[col.key] = {
                    visible: col.visibleByDefault ?? false,
                    order: index,
                };
                return acc;
            }, {} as Record<string, TableColumnState>),
        page: queryParams?.page || 1,
        perPage:
            queryParams?.perPage || uiPreferences?.perPage || perPageDefault,
        searchConfig,
        searchTerm: queryParams?.searchTerm || "",
        searchFuzziness: queryParams?.searchFuzziness,
        filterConfigs,
        filterStates: queryParams?.filterStates,
        sortBy:
            (queryParams &&
                sortByOptions.find((opt) => opt.key === queryParams.sortBy)) ||
            (uiPreferences &&
                sortByOptions.find(
                    (opt) => opt.key === uiPreferences.sortBy
                )) ||
            sortByOptions[0],
        selectedIds: new Set<string>(),
        isAllSelected: false,
    };
}
