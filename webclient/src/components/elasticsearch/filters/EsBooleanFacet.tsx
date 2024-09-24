import React from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";

const EsBooleanFacet: React.FC<EsFacetProps> = ({ attribute, label }) => {
    return (
        <EsFacet
            attribute={attribute}
            label={label}
            limit={2}
            sortBy={["name:desc"]}
            transformItems={(items) =>
                items.map((item) => ({
                    ...item,
                    label: item.value === "1" ? "Yes" : "No",
                }))
            }
        />
    );
};

export default EsBooleanFacet;
