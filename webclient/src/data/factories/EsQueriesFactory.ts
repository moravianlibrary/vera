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

export { filterBooleanQuery };
