import type { EsPageState } from "../domains/es";

export function selectPage(state: EsPageState): number | undefined {
    return state.request.from != null && state.request.size != null
        ? Math.floor(state.request.from / state.request.size) + 1
        : undefined;
}

export function selectPerPage(state: EsPageState): number | undefined {
    return state.request.size;
}
