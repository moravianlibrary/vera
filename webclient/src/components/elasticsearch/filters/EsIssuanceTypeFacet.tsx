import React from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";
import { IssuanceType } from "../../../types/IssuanceType";
import IssuanceTypeTag from "../../tags/IssuanceTypeTag";

const EsIssuanceTypeFacet: React.FC<EsFacetProps> = (props) => {
    return (
        <EsFacet
            {...props}
            onDisplayLabel={(item) => (
                <IssuanceTypeTag issuanceType={item.value as IssuanceType} />
            )}
        />
    );
};

export default EsIssuanceTypeFacet;
