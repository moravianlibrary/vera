import AddDocumentResponseStatus from "../types/AddDocumentResponseStatus";

const FACETS_QUERY = {
    size: 0,
    from: 0,
    query: {
        match_all: {},
    },
    aggs: {
        status_facet: {
            terms: { field: "status", size: 20 },
        },
    },
};
function getStatusPageQuery(
    status: AddDocumentResponseStatus,
    page: number,
    pageSize: number
) {
    return {
        size: pageSize,
        from: (page - 1) * pageSize,
        query: {
            bool: {
                must: {
                    term: {
                        status: status,
                    },
                },
            },
        },
    };
}

function getResponseQuery(id: string) {
    return {
        size: 1,
        query: {
            bool: {
                must: {
                    term: {
                        id: id,
                    },
                },
            },
        },
    };
}

export { FACETS_QUERY, getStatusPageQuery, getResponseQuery };
