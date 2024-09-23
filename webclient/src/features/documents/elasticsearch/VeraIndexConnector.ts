import { QueryConfig, RequestState, ResponseState } from "@elastic/search-ui";
import ElasticsearchAPIConnector, {
    SearchRequest,
} from "@elastic/search-ui-elasticsearch-connector";

function postProcessRequestBody(
    requestBody: SearchRequest,
    requestState: RequestState,
    queryConfig: QueryConfig
): SearchRequest {
    if (queryConfig && queryConfig.facets && requestBody.aggs) {
        const queryConfigFacets = queryConfig.facets;

        Object.keys(requestBody.aggs).forEach((facetKey) => {
            const facet = requestBody.aggs![facetKey];
            const configFacet = queryConfigFacets[facetKey];
            if (configFacet && (configFacet as any).sort_order) {
                const orderKey =
                    requestBody.aggs[facetKey].terms.order?.keys[0];
                console.log("Changind order", orderKey);

                requestBody.aggs[facetKey].terms.order = {
                    orderKey: (facet as any).sort_order,
                };
            }
        });
    }

    console.log(requestBody);
    console.log(requestState);
    console.log(queryConfig);

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
