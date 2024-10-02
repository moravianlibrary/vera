import React, { Fragment } from "react";
import EsBooleanFacet from "../../components/elasticsearch/filters/EsBooleanFacet";
import EsDigitizationStateFacet from "../../components/elasticsearch/filters/EsDigitizationStateFacet";
import EsFacet from "../../components/elasticsearch/filters/EsFacet";
import EsCategoryFacet from "../../components/elasticsearch/filters/EsCategoryFacet";
import EsDigitizationListFacet from "../../components/elasticsearch/filters/EsDigitizationListFacet";
import EsRangeFacet from "../../components/elasticsearch/filters/EsRangeFacet";
import EsMaterialTypeFacet from "../../components/elasticsearch/filters/EsMaterialTypeFacet";
import EsIssuanceTypeFacet from "../../components/elasticsearch/filters/EsIssuanceTypeFacet";
import EsQueryRulesLayout from "../../components/layouts/EsQueryRulesLayout";
import { RangeInput } from "react-instantsearch";

interface DocumentsQueryRulesProps {}

export const DocumentsQueryRules: React.FC<DocumentsQueryRulesProps> = () => {
    return (
        <EsQueryRulesLayout
            facets={
                <Fragment>
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
                    <EsMaterialTypeFacet
                        attribute="material_type"
                        label="Material Type"
                    />
                    <EsIssuanceTypeFacet
                        attribute="issuance_type"
                        label="Issuance Type"
                    />
                    <EsFacet attribute="added_by" label="Added By" />
                    <EsCategoryFacet attribute="category_id" label="Category" />
                    <EsDigitizationListFacet
                        attribute="digitization_list_id"
                        label="Digitization List"
                        results={10}
                    />
                    <EsRangeFacet
                        attribute="volume_number"
                        label="Volume Number"
                    />
                </Fragment>
            }
        />
    );
};

export default DocumentsQueryRules;
