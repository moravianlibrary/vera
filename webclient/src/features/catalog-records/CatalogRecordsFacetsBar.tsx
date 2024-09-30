import React from "react";
import EsFacet from "../../components/elasticsearch/filters/EsFacet";
import EsBooleanFacet from "../../components/elasticsearch/filters/EsBooleanFacet";

interface CatalogRecordsFacetsBarProps {}

const CatalogRecordsFacetsBar: React.FC<CatalogRecordsFacetsBarProps> = () => {
    return (
        <div>
            <EsBooleanFacet
                attribute="has_valid_main_record"
                label="Has valid main record"
            />
            <EsBooleanFacet attribute="has_valid_cnb" label="Has valid cnb" />
            <EsFacet attribute="material_type" label="Material Type" />
        </div>
    );
};

export default CatalogRecordsFacetsBar;
