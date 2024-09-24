import React from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";
import DigitizationStateTag from "../../../components/tags/DigitizationStateTag";
import { DigitizationState } from "../../../types/DigitizationState";

const EsDigitizationStateFacet: React.FC<EsFacetProps> = (props) => {
    return (
        <EsFacet
            {...props}
            onDisplayLabel={(item) => (
                <DigitizationStateTag state={item.value as DigitizationState} />
            )}
        />
    );
};

export default EsDigitizationStateFacet;
