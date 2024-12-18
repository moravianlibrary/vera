import { EsSort } from "./IndexSettings";

type EsFacetValue = string | number | boolean;

interface EsActiveFacet {
    field: string;
    value?: EsFacetValue | EsFacetValue[];
}

interface EsParamsState {
    query?: string;
    queryExact?: boolean;
    activeFacets?: EsActiveFacet[];
}

interface EsUiState extends EsParamsState {
    sort?: EsSort;
    page: number;
    pageSize: number;
}

export type { EsFacetValue, EsActiveFacet, EsParamsState, EsUiState };
