import { APIConnector, AutocompleteQueryConfig, AutocompleteResponseState, QueryConfig, RequestState, ResponseState } from "@elastic/search-ui";
import ApiDocuments from "../../../adapters/ApiDocuments";


class VeraIndexConnector implements APIConnector {
    state?: any;
    afterResponse: (response: any) => any;

    async onSearch(
      state: RequestState,
      queryConfig: QueryConfig
    ): Promise<ResponseState> {
        const filters = state.filters ? state.filters.map(filter => {
            switch (filter.type) {
                case 'all':
                    return {
                        terms: {
                            [filter.field]: filter.values.map(value => value === "true" ? true : value === "false" ? false : value)
                        }
                    };
                case "any":
                    return {terms: {
                        [filter.field]: filter.values
                    }
                };
                default:
                    return {};
            }
        }) : [];
        console.log(filters);
        
        
        const esQuery = {
            size: state.resultsPerPage || 20,
            from: ((state.current || 1) - 1) * (state?.resultsPerPage || 20),
            query: {
                bool: {
                // filter: [],
                filter: filters,
                must: [],
                should: []
                }
            },
            aggs: {},
            sort: []
        };

        if (queryConfig.facets) {
            Object.entries(queryConfig.facets).forEach(([facetName, facetConfig]) => {
                if (facetConfig.type === "value") {
                    esQuery.aggs[facetName] = {
                        terms: {
                            field: facetName,
                            size: facetConfig.size || 10
                        }
                    };
                }
            });
        }
        
        const response = await ApiDocuments.queryDocuments(esQuery);
        this.afterResponse(response.data.hits);
        this.state = state;

        const facets = response.data.aggregations ? Object.entries(response.data.aggregations).reduce((acc, [name, body]) => {
            return {
                ...acc,
                [name]: [
                    {
                        data: (body as any).buckets.map((e) => ({
                            value: e.key_as_string || e.key,
                            count: e.doc_count
                        })),
                        type: "value"
                    }
                ]
            };
        }, {}) : {};
        
        // (response.data.aggregations || []).forEach((aggregation) => {
        //     console.log(aggregation);
            
        // })

        // const facets = (response.data.aggregations || []).reduce((acc, facet) => {
        //     return {
        //     ...acc,
        //     [facet.identifier]: [
        //         {
        //         data: facet.entries.map((e) => ({
        //             value: e.label,
        //             count: e.count
        //         })),
        //         type: "value"
        //         }
        //     ]
        //     };
        // }, {});
        
        return {
            requestId: "1",
            facets: facets,
            resultSearchTerm: state.searchTerm || "",
            totalPages: 2,
            totalResults: 20,
            pagingStart: 0,
            pagingEnd: 20,
            wasSearched: false,
            results: response.data.hits,
            rawResponse: response
        };
    }

    async onAutocomplete(
        state: RequestState,
        queryConfig: AutocompleteQueryConfig
    ): Promise<AutocompleteResponseState> {
        const response = await fetch(
          "https://api.my-host/autocomplete?query" + state.searchTerm,
          {
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
        // response will need to be in the shape of AutocompleteResponseState.
        // Alternatively you could transform the response here
        return response.json();
      }
      onResultClick(params): void {
        console.log(
          "perform a call to the API to highlight a result has been clicked"
        );
      }
      onAutocompleteResultClick(params): void {
        console.log(
          "perform a call to the API to highlight an autocomplete result has been clicked"
        );
      }
}

export default VeraIndexConnector;
