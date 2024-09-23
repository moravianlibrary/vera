import { MaterialType } from "../../../types/MaterialType";
import { IssuanceType } from "../../../types/IssuanceType";
import { authHeader } from "../../../adapters/ApiBase";
import VeraIndexConnector, {
    postProcessRequestBody,
} from "./VeraIndexConnector";
import { FacetConfiguration } from "@elastic/search-ui";

const esConfig = {
    // debug: true,
    alwaysSearchOnInitialLoad: true,
    apiConnector: new VeraIndexConnector(
        {
            host: "http://localhost:8000",
            index: "documents",
            connectionOptions: {
                headers: authHeader() as Record<string, string>,
            },
        },
        postProcessRequestBody
    ),
    searchQuery: {
        result_fields: {},
        //     id: { raw: {} },
        //     visitors: { raw: {} },
        //     world_heritage_site: { raw: {} },
        //     location: { raw: {} },
        //     acres: { raw: {} },
        //     square_km: { raw: {} },
        //     title: {
        //         snippet: {
        //         size: 100,
        //         fallback: true
        //         }
        //     },
        //     nps_link: { raw: {} },
        //     states: { raw: {} },
        //     date_established: { raw: {} },
        //     image_url: { raw: {} },
        //     description: {
        //         snippet: {
        //         size: 100,
        //         fallback: true
        //     }
        // }
        // },
        disjunctiveFacets: [
            "has_valid_main_record",
            "has_valid_cnb",
            "material_type",
            "issuance_type",
            "digitization_state",
            "added_by",
            "digitization_list_id",
            "category_id",
        ],
        facets: {
            is_extractable: {
                type: "boolean",
                size: 2,
            },
            has_valid_main_record: {
                type: "boolean",
                size: 2,
            },
            has_valid_cnb: {
                type: "boolean",
                size: 2,
            },
            material_type: {
                type: "value",
                size: Object.values(MaterialType).length,
            },
            issuance_type: {
                type: "value",
                size: Object.values(IssuanceType).length,
            },
            digitization_state: {
                type: "value",
                size: 5,
            },
            added_by: {
                type: "value",
                size: 25,
            },
            category_id: {
                type: "value",
                size: 100,
            },
            digitization_list_id: {
                type: "value",
                sort: "value",
                sort_order: "desc",
                size: 5,
            } as FacetConfiguration,
        },
        aggregations: {
            min_volume: {
                min: {
                    field: "volume_number",
                },
            },
            max_volume: {
                max: {
                    field: "volume_number",
                },
            },
        },
    },
    //   autocompleteQuery: {
    //     results: {
    //       resultsPerPage: 5,
    //       result_fields: {
    //         title: {
    //           snippet: {
    //             size: 100,
    //             fallback: true
    //           }
    //         },
    //         nps_link: {
    //           raw: {}
    //         }
    //       }
    //     },
    //     suggestions: {
    //       types: {
    //         documents: {
    //           fields: ["title"]
    //         }
    //       },
    //       size: 4
    //     }
    //   }
};

const SORT_OPTIONS = [
    {
        name: "Relevance",
        value: [],
    },
    {
        name: "Title",
        value: [
            {
                field: "title",
                direction: "asc",
            },
        ],
    },
    //   {
    //     name: "State",
    //     value: [
    //       {
    //         field: "states",
    //         direction: "asc"
    //       }
    //     ]
    //   },
    //   {
    //     name: "State -> Title",
    //     value: [
    //       {
    //         field: "states",
    //         direction: "asc"
    //       },
    //       {
    //         field: "title",
    //         direction: "asc"
    //       }
    //     ]
    //   },
    //   {
    //     name: "Heritage Site -> State -> Title",
    //     value: [
    //       {
    //         field: "world_heritage_site",
    //         direction: "asc"
    //       },
    //       {
    //         field: "states",
    //         direction: "asc"
    //       },
    //       {
    //         field: "title",
    //         direction: "asc"
    //       }
    //     ]
    //   }
];

export { esConfig, SORT_OPTIONS };
