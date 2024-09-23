import React from "react";
import { Facet, Sorting } from "@elastic/react-search-ui";
import { SORT_OPTIONS } from "./EsDocumentsConfig";
import {
    BooleanFacetView,
    CategoryFacetView,
    DigitizationListFacetView,
    DigitizationStateFacetView,
    ListFacetView,
} from "./EsFacetViews";
import {
    EsFilterByDigitizationList,
    VolumeNumberFilterView,
} from "./EsFilterView";

import Searchkit from "searchkit";
import Client from "@searchkit/instantsearch-client";
import {
    InstantSearch,
    SearchBox,
    Hits,
    RefinementList,
    Pagination,
    RangeInput,
} from "react-instantsearch";
import ApiDocuments from "../../../adapters/ApiDocuments";
import { SearchRequest } from "@elastic/search-ui-elasticsearch-connector";

const sk = new Searchkit({
    connection: {
        // host: "http://localhost:8000",
        // withCredentials: false,
        msearch: (requests) => {
            return Promise.all(
                requests.map((request) => {
                    return ApiDocuments.queryDocuments(request.body).then(
                        (response) => {
                            return response.data;
                        }
                    );
                })
            );
        },
    },
    search_settings: {
        search_attributes: [{ field: "title", weight: 3 }, "actors", "plot"],
        result_attributes: ["title", "actors", "poster", "plot"],
        highlight_attributes: ["title"],
        facet_attributes: [
            { attribute: "actors", field: "actors.keyword", type: "string" },
            { attribute: "imdbrating", type: "numeric", field: "imdbrating" },
        ],
    },
});

interface DocumentsFiltersViewProps {}

export const DocumentsFiltersView: React.FC<DocumentsFiltersViewProps> = () => {
    const searchClient = Client(sk);
    return (
        <div
            className="surface-50 border-right-1 border-200"
            style={{
                height: "calc(100vh - 180px)",
                overflowY: "auto",
            }}
        >
            <Sorting label={"Sort by"} sortOptions={SORT_OPTIONS} />
            <Facet
                field={"is_extractable"}
                label="Is extractable"
                view={BooleanFacetView}
            />
            <Facet
                field={"has_valid_main_record"}
                label="Has valid main record"
                view={BooleanFacetView}
            />
            <Facet
                field={"has_valid_cnb"}
                label="Has valid CNB"
                view={BooleanFacetView}
            />
            <Facet
                field="digitization_state"
                label="Digitization State"
                filterType="all"
                view={DigitizationStateFacetView}
            />
            <Facet
                field="material_type"
                label="Material Type"
                view={ListFacetView}
            />
            <Facet
                field="issuance_type"
                label="Issuance Type"
                view={ListFacetView}
            />

            <Facet field="added_by" label="Added By" view={ListFacetView} />
            {/* <Facet field="volume_number" label="Volume" view={ListFacetView} /> */}
            <Facet
                field="category_id"
                label="Category"
                show={100}
                view={CategoryFacetView}
            />
            <Facet
                field="category_path"
                label="Category"
                view={ListFacetView}
            />
            <Facet
                field="digitization_list_id"
                label="Digitization List"
                view={DigitizationListFacetView}
            />
            <VolumeNumberFilterView
                field={["min_volume", "max_volume"]}
                label="Volume"
            />

            <InstantSearch indexName="imdb_movies" searchClient={searchClient}>
                <SearchBox />
                <div className="left-panel">
                    <RefinementList
                        attribute="actors"
                        searchable={true}
                        limit={10}
                    />
                    <RangeInput attribute="imdbrating" />
                </div>
                <div className="right-panel">
                    <Hits />
                    <Pagination />
                </div>
            </InstantSearch>
        </div>
    );
};

export default DocumentsFiltersView;
