type EsFacetValue = string | number | boolean;

interface EsActiveFacet {
    field: string;
    value?: EsFacetValue | EsFacetValue[];
}

interface EsUiState {
    query?: string;
    activeFacets?: EsActiveFacet[];
}

export type { EsFacetValue, EsActiveFacet, EsUiState };
