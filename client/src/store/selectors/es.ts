import type {
    EsQueryParams,
    EsSessionState,
    EsUiPreferences,
} from "../domains/es";

export function selectUiPreferences(state: EsSessionState): EsUiPreferences {
    return {
        columnStates: state.columnStates,
        perPage: state.perPage,
        sortBy: state.sortBy.key,
    };
}

export function selectQueryParams(state: EsSessionState): EsQueryParams {
    return {
        page: state.page,
        perPage: state.perPage,
        searchTerm: state.searchTerm,
        searchFuzziness: state.searchFuzziness,
        filterStates: state.filterStates,
        sortBy: state.sortBy.key,
    };
}
