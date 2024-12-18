interface EsSearchAttribute {
    field: string;
    weight: number;
}

type EsSortOrder = "asc" | "desc";

interface EsSort {
    field: string;
    order: EsSortOrder;
}

type EsFacetOrder = { _key: "asc" | "desc" };

interface EsFacetAttribute {
    field: string;
    type: "string" | "boolean" | "numeric" | "nested" | "object";
    limit?: number;
    attributes?: string[];
    order?: EsFacetOrder;
}

type EsFilterAttributes = Record<string, "value" | "range">;

interface EsIndexSettings {
    index_name: string;
    search_attributes?: (string | EsSearchAttribute)[];
    result_attributes: string[];
    facet_attributes?: EsFacetAttribute[];
    filter_attributes?: EsFilterAttributes;
    sorting?: Record<string, EsSort | EsSort[]>;
}

export type {
    EsIndexSettings,
    EsSearchAttribute,
    EsSort,
    EsFacetAttribute,
    EsSortOrder,
};
