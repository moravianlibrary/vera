import React from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";
import { MaterialType } from "../../../types/MaterialType";
import MaterialTypeTag from "../../tags/MaterialTypeTag";

const EsMaterialTypeFacet: React.FC<EsFacetProps> = (props) => {
    return (
        <EsFacet
            {...props}
            onDisplayLabel={(item) => (
                <MaterialTypeTag materialType={item.value as MaterialType} />
            )}
        />
    );
};

export default EsMaterialTypeFacet;
