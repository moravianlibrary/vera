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

export { filterBooleanQuery, filterNestedQuery };
