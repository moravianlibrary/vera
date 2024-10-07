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

const filterNestedQuery = (filters) => {
    const nestedFilters = filters.map((filter) => ({
        term: {
            [`cnb_difference.${filter.field}`]: filter.value,
        },
    }));

    return {
        nested: {
            path: "cnb_difference",
            query: {
                bool: {
                    must: nestedFilters,
                },
            },
        },
    };
};

function stateToRoute(indexName, booleanAttributes, uiState) {
    const indexUiState = uiState[indexName] || {};

    return {
        query: indexUiState.query,
        ...Object.keys(indexUiState.refinementList || {}).reduce((acc, key) => {
            acc[key] = (
                booleanAttributes.includes(key)
                    ? indexUiState.refinementList[key].map((v) =>
                          v === "1" ? "true" : "false"
                      )
                    : indexUiState.refinementList[key]
            ).join(",");
            return acc;
        }, {}),
        page_size: indexUiState.hitsPerPage,
        page: indexUiState.page,
    };
}

function routeToState(indexName, booleanAttributes, routeState) {
    console.log("routeState", routeState);

    return {
        [indexName]: {
            query: routeState.query,
            hitsPerPage: routeState.page_size,
            page: routeState.page,
            refinementList: Object.keys(routeState).reduce((acc, key) => {
                if (key !== "query" && key !== "page_size" && key !== "page") {
                    const values = routeState[key].split(",");
                    acc[key] = booleanAttributes.includes(key)
                        ? values.map((v) => (v === "true" ? "1" : "0"))
                        : values;
                }
                return acc;
            }, {}),
        },
    };
}

export { filterBooleanQuery, filterNestedQuery, stateToRoute, routeToState };
