import {
    FacetConfiguration,
    QueryConfig,
    RequestState,
    ResponseState,
} from "@elastic/search-ui";
import ElasticsearchAPIConnector, {
    SearchRequest,
} from "@elastic/search-ui-elasticsearch-connector";

function postProcessRequestBody(
    requestBody: SearchRequest,
    requestState: RequestState,
    queryConfig: QueryConfig
): SearchRequest {
    function changeSortOrder(
        facetConfiguration: FacetConfiguration,
        aggregations: any
    ) {
        if (
            facetConfiguration &&
            (facetConfiguration as any).sort_order &&
            aggregations.terms &&
            aggregations.terms.order
        ) {
            aggregations.terms.order = {
                _key: (facetConfiguration as any).sort_order,
            };
        }
    }

    if (queryConfig && queryConfig.facets && requestBody.aggs) {
        Object.values(requestBody.aggs)
            .filter((facetBucket) => facetBucket.aggs)
            .forEach((facetBucket) =>
                Object.keys(facetBucket.aggs!).forEach((facetKey) =>
                    changeSortOrder(
                        queryConfig.facets![facetKey],
                        facetBucket.aggs![facetKey]
                    )
                )
            );
    }
    if (
        queryConfig &&
        (queryConfig as any).aggregations &&
        requestBody.aggs &&
        requestBody.aggs.facet_bucket_all &&
        requestBody.aggs.facet_bucket_all.aggs
    ) {
        requestBody.aggs.facet_bucket_all.aggs = {
            ...requestBody.aggs.facet_bucket_all.aggs,
            ...(queryConfig as any).aggregations,
        };
    }

    return requestBody;
}

class VeraIndexConnector extends ElasticsearchAPIConnector {
    state: RequestState;
    afterSearch?: (response: ResponseState) => void;

    async onSearch(
        state: RequestState,
        queryConfig: QueryConfig
    ): Promise<ResponseState> {
        const booleanFacetKeys: string[] = queryConfig.facets
            ? Object.entries(queryConfig.facets)
                  .filter(([key, facet]) => facet.type === "boolean")
                  .map(([key]) => key)
            : [];
        const transformedQueryConfig =
            queryConfig.facets === undefined || booleanFacetKeys.length === 0
                ? queryConfig
                : {
                      ...queryConfig,
                      facets: {
                          ...queryConfig.facets,
                          ...Object.fromEntries(
                              booleanFacetKeys.map((key) => [
                                  key,
                                  {
                                      ...queryConfig.facets![key],
                                      type: "value",
                                  },
                              ])
                          ),
                      },
                  };

        this.state = { ...state };

        const response = await super.onSearch(state, transformedQueryConfig);

        booleanFacetKeys.forEach((facetKey) => {
            response.facets[facetKey][0].data = response.facets[
                facetKey
            ][0].data.map((item) => {
                return {
                    value: item.value === 1,
                    count: item.count,
                };
            });
        });

        if (this.afterSearch) {
            this.afterSearch(response);
        }

        // console.log("response", response);

        return response;
    }

    // async onAutocomplete(
    //     state: RequestState,
    //     queryConfig: AutocompleteQueryConfig
    // ): Promise<AutocompleteResponseState> {
    //     const response = await fetch(
    //       "https://api.my-host/autocomplete?query" + state.searchTerm,
    //       {
    //         headers: {
    //           "Content-Type": "application/json"
    //         }
    //       }
    //     );
    //     // response will need to be in the shape of AutocompleteResponseState.
    //     // Alternatively you could transform the response here
    //     return response.json();
    //   }
}

export default VeraIndexConnector;
export { postProcessRequestBody };
