import type { EsFilterState } from "../../components/organisms/EsFilters";
import type { EsRequest } from "../../models/api/requests/es";

export interface EsPageState {
    request: EsRequest;
    // Search
    searchTerm: string;
    searchFuzziness?: string;
    // Filter
    filterStates?: Record<string, EsFilterState>;
    // Selection
    isAllSelected: boolean;
    selectedIds: Set<string>;
}

export interface EsSearchConfig {
    fields: string[];
    phraseBoosts?: Record<string, number>;
    prefixBoosts?: Record<string, number>;
    fuzzyBoosts?: Record<string, number>;
}

export type EsRequestAction =
    | { type: "setPagination"; page: number; perPage: number }
    | { type: "setSearchTerm"; value: string }
    | { type: "submitSearch"; config: EsSearchConfig }
    | { type: "clearSearch" }
    | { type: "setFilter"; field: string; newState: EsFilterState }
    | { type: "clearFilters"; field?: string }
    | { type: "toggleSelection"; id: string }
    | { type: "clearSelection" }
    | { type: "selectPage" }
    | { type: "selectAll" };

export function initEsPageState(
    page: number = 1,
    perPage: number = 10,
    searchTerm: string = "",
    searchFuzziness?: string,
    filterStates?: Record<string, EsFilterState>
): EsPageState {
    return {
        request: {
            query: { match_all: {} },
            from: (page - 1) * perPage,
            size: perPage,
        },
        searchTerm,
        searchFuzziness,
        filterStates,
        isAllSelected: false,
        selectedIds: new Set<string>(),
    };
}
