import React from "react";
import { Facet, Sorting } from "@elastic/react-search-ui";
import { SORT_OPTIONS } from "./EsDocumentsConfig";
import {
    BooleanFacetView,
    DigitizationListFacetView,
    DigitizationStateFacetView,
    ListFacetView,
} from "./EsFacetViews";
import { EsFilterByDigitizationList } from "./EsFilterView";

interface DocumentsFiltersViewProps {}

export const DocumentsFiltersView: React.FC<DocumentsFiltersViewProps> = () => {
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
                field="digitization_list_id"
                label="Digitization List"
                view={DigitizationListFacetView}
            />
        </div>
    );
};

export default DocumentsFiltersView;
