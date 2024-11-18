import React, { useEffect, useState } from "react";
import { EsFacetProps } from "./EsFacet";
import EsFilter from "./EsFilter";
import { useRefinementList } from "react-instantsearch";
import { Chip } from "primereact/chip";

const EsIdFacet: React.FC<EsFacetProps> = ({ label, ...restOfProps }) => {
    const { items, refine } = useRefinementList(restOfProps);

    const [isActive, setIsActive] = useState<boolean>(
        items.some((item) => item.isRefined)
    );

    useEffect(() => {
        setIsActive(items.some((item) => item.isRefined));
    }, [items]);

    const handleCancelFilter = () => {
        refine(items.find((item) => item.isRefined).value);
        console.log("refine", items.find((item) => item.isRefined).value);
    };

    if (!Array.isArray(items) || !isActive) return null;

    const refinedItem = items.find((item) => item.isRefined);
    if (!refinedItem) return null;

    return (
        <EsFilter label={label}>
            <Chip
                className="white-space-nowrap w-min"
                key={"query-params-query"}
                label={refinedItem.label}
                removable
                onRemove={handleCancelFilter}
            />
        </EsFilter>
    );
};

export default EsIdFacet;
