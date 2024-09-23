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
        // disjunctiveFacets: ["material_type", "issuance_type", "digitization_state"],
        disjunctiveFacets: [
            "has_valid_main_record",
            "has_valid_cnb",
            "material_type",
            "issuance_type",
            "digitization_state",
            "added_by",
            "digitization_list_id",
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
            volume_number: {
                type: "value",
                size: 100,
            },
            digitization_list_id: {
                type: "value",
                sort: "value",
                sort_order: "desc",
                size: 10,
            } as FacetConfiguration,
            //   world_heritage_site: { type: "value" },
            //   states: { type: "value", size: 30 },
            //   acres: {
            //     type: "range",
            //     ranges: [
            //       { from: -1, name: "Any" },
            //       { from: 0, to: 1000, name: "Small" },
            //       { from: 1001, to: 100000, name: "Medium" },
            //       { from: 100001, name: "Large" }
            //     ]
            //   },
            //   location: {
            //     center: "37.7749, -122.4194",
            //     type: "range",
            //     unit: "mi",
            //     ranges: [
            //       { from: 0, to: 100, name: "Nearby" },
            //       { from: 100, to: 500, name: "A longer drive" },
            //       { from: 500, name: "Perhaps fly?" }
            //     ]
            //   },
            //   date_established: {
            //     type: "range",
            //     ranges: [
            //       {
            //         from: moment().subtract(50, "years").toISOString(),
            //         name: "Within the last 50 years"
            //       },
            //       {
            //         from: moment().subtract(100, "years").toISOString(),
            //         to: moment().subtract(50, "years").toISOString(),
            //         name: "50 - 100 years ago"
            //       },
            //       {
            //         to: moment().subtract(100, "years").toISOString(),
            //         name: "More than 100 years ago"
            //       }
            //     ]
            //   },
            //   visitors: {
            //     type: "range",
            //     ranges: [
            //       { from: 0, to: 10000, name: "0 - 10000" },
            //       { from: 10001, to: 100000, name: "10001 - 100000" },
            //       { from: 100001, to: 500000, name: "100001 - 500000" },
            //       { from: 500001, to: 1000000, name: "500001 - 1000000" },
            //       { from: 1000001, to: 5000000, name: "1000001 - 5000000" },
            //       { from: 5000001, to: 10000000, name: "5000001 - 10000000" },
            //       { from: 10000001, name: "10000001+" }
            //     ]
            //   }
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
