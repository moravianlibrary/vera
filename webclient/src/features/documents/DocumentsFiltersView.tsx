import React from "react";

import EsBooleanFacet from "../../components/elasticsearch/filters/EsBooleanFacet";
import EsDigitizationStateFacet from "../../components/elasticsearch/filters/EsDigitizationStateFacet";
import EsFacet from "../../components/elasticsearch/filters/EsFacet";
import EsCategoryFacet from "../../components/elasticsearch/filters/EsCategoryFacet";
import EsDigitizationListFacet from "../../components/elasticsearch/filters/EsDigitizationListFacet";
import EsRangeFacet from "../../components/elasticsearch/filters/EsRangeFacet";

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
            {/* <SearchBox /> */}
            <div className="left-panel">
                <EsBooleanFacet
                    attribute="is_extractable"
                    label="Is extractable"
                />
                <EsBooleanFacet
                    attribute="has_valid_main_record"
                    label="Has valid main record"
                />
                <EsBooleanFacet
                    attribute="has_valid_cnb"
                    label="Has valid CNB"
                />
                <EsDigitizationStateFacet
                    attribute="digitization_state"
                    label="Digitization State"
                />
                <EsFacet attribute="material_type" label="Material Type" />
                <EsFacet attribute="issuance_type" label="Issuance Type" />
                <EsFacet attribute="added_by" label="Added By" />
                <EsCategoryFacet attribute="category_id" label="Category" />
                <EsDigitizationListFacet
                    attribute="digitization_list_id"
                    label="Digitization List"
                    results={10}
                />
                <EsRangeFacet attribute="volume_number" label="Volume Number" />
            </div>
        </div>
    );
};

export default DocumentsFiltersView;
