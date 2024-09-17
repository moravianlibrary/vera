import { APIConnector, AutocompleteQueryConfig, AutocompleteResponseState, QueryConfig, RequestState, ResponseState } from "@elastic/search-ui";
import ApiDocuments from "../../../adapters/ApiDocuments";
import { adaptRequest } from "./adapters/RequestAdapters";
import { adaptResponse } from "./adapters/ResponseAdapter";
import buildResponseAdapterOptions from "./adapters/BuildResponseAdapterOptions";
import removeEmptyFacetsAndFilters from "./adapters/RemoveEmptyAdapter";



class VeraIndexConnector implements APIConnector {
    afterResponse: (response: any) => any;

    async onSearch(
      state: RequestState,
      queryConfig: QueryConfig
    ): Promise<ResponseState> {
        console.log("query");
        console.log(state);
        console.log(queryConfig);

        const esQuery: Object = {
            size: queryConfig.resultsPerPage || 20,
            from: ((queryConfig.current || 1) - 1) * (queryConfig?.resultsPerPage || 20),
            query: {
                bool: {
                filter: [],
                must: [],
                should: []
                }
            },
            aggs: {},
            sort: []
        };
        
        const response = await ApiDocuments.queryDocuments(esQuery);
        this.afterResponse(response.data.hits);
        
        return {
            requestId: "1",
            facets: {},
            resultSearchTerm: state.searchTerm || "",
            totalPages: 2,
            totalResults: 20,
            pagingStart: 0,
            pagingEnd: 20,
            wasSearched: true,
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
