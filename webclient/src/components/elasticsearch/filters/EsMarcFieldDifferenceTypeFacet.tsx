import React from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";
import MarcFieldDifferenceTypeTag from "../../tags/MarcFieldDifferenceTypeTag";
import MarcFieldDifferenceType from "../../../types/MarcFieldDifferenceType";

const EsMarcFieldDifferenceTypeFacet: React.FC<EsFacetProps> = (props) => {
    return (
        <EsFacet
            {...props}
            onDisplayLabel={(item) => (
                <MarcFieldDifferenceTypeTag
                    differenceType={item.value as MarcFieldDifferenceType}
                />
            )}
        />
    );
};

export default EsMarcFieldDifferenceTypeFacet;
