import { IndexSettingsDispatcher } from "../../config/elasticsearch";

function filterBooleanQuery(field: string, value: string) {
    return {
        bool: {
            should: [
                {
                    term: {
                        [field]: value === "1" ? "true" : "false",
                    },
                },
            ],
        },
    };
}

function sortFacetDescByKey(field, size) {
    return {
        terms: {
            field,
            size,
            order: {
                _key: "desc",
            },
        },
    };
}

function stateToQuery(indexName, uiState) {
    const stateAsBoolean = IndexSettingsDispatcher[indexName].facet_attributes
        .filter((fa) => fa.stateAs === "boolean")
        .map((fa) => fa.attribute);
    const indexUiState = uiState[indexName] || {};

    return {
        index_name: indexName,
        query: indexUiState.query,
        ...Object.keys(indexUiState.refinementList || {}).reduce((acc, key) => {
            acc[key] = (
                stateAsBoolean.includes(key)
                    ? indexUiState.refinementList[key].map((v) =>
                          v === "1" ? "true" : "false"
                      )
                    : indexUiState.refinementList[key]
            ).join(",");
            return acc;
        }, {}),
        ...Object.keys(indexUiState.range || {}).reduce((acc, key) => {
            acc[key] = indexUiState.range[key];
            return acc;
        }, {}),
    };
}

function stateToRoute(indexName, uiState) {
    return {
        ...stateToQuery(indexName, uiState),
        page: uiState[indexName] && uiState[indexName].page,
        page_size: uiState[indexName] && uiState[indexName].hitsPerPage,
    };
}

function routeToState(indexName, routeState) {
    const stateAsBoolean = IndexSettingsDispatcher[indexName].facet_attributes
        .filter((fa) => fa.stateAs === "boolean")
        .map((fa) => fa.attribute);

    return {
        [indexName]: {
            query: routeState.query,
            hitsPerPage: routeState.page_size,
            page: routeState.page,
            refinementList: Object.keys(routeState).reduce((acc, key) => {
                if (
                    !["indexName", "query", "page_size", "page"].includes(
                        key
                    ) &&
                    !/^\d+:\d+|\d+:|:\d+$/.test(routeState[key])
                ) {
                    const values = routeState[key].split(",");
                    acc[key] = stateAsBoolean.includes(key)
                        ? values.map((v) => (v === "true" ? "1" : "0"))
                        : values;
                }
                return acc;
            }, {}),
            range: Object.keys(routeState).reduce((acc, key) => {
                if (
                    !["indexName", "query", "page_size", "page"].includes(
                        key
                    ) &&
                    /^\d+:\d+|\d+:|:\d+$/.test(routeState[key])
                ) {
                    acc[key] = routeState[key];
                }
                return acc;
            }, {}),
        },
    };
}

export {
    filterBooleanQuery,
    stateToQuery,
    stateToRoute,
    routeToState,
    sortFacetDescByKey,
};
