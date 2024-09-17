
export default function removeEmptyFacetsAndFilters(options) {
    const { facets, filters, ...rest } = options;
    return {
        ...(facets && Object.entries(facets).length > 0 && { facets }),
        ...(filters && Object.entries(filters).length > 0 && { filters }),
        ...rest
    };
}