import React from "react";
import EsFilter from "./EsFilter";
import { Checkbox } from "primereact/checkbox";
import { RefinementListProps, useRefinementList } from "react-instantsearch";

interface EsFacetProps extends RefinementListProps {
    label: string;
    onDisplayLabel?: (item) => React.ReactNode;
}

const EsFacet: React.FC<EsFacetProps> = (props) => {
    const {
        items,
        hasExhaustiveItems,
        createURL,
        refine,
        sendEvent,
        searchForItems,
        isFromSearch,
        canRefine,
        canToggleShowMore,
        isShowingMore,
        toggleShowMore,
    } = useRefinementList(props);
    console.log("items", items);

    if (!canRefine) return null;

    const displayLabel = (item) => {
        if (props.onDisplayLabel) {
            return props.onDisplayLabel(item);
        } else {
            return (
                <label htmlFor={`es-${props.label}-${item.label}-checkbox`}>
                    {item.label}
                </label>
            );
        }
    };

    return (
        <EsFilter label={props.label}>
            {items.map((item) => (
                <div
                    key={item.value}
                    className={
                        item.isRefined
                            ? "es-facet-value es-active-facet-value"
                            : "es-facet-value"
                    }
                >
                    <div className="es-checkbox">
                        <Checkbox
                            className={`es-${item.value}-checkbox`}
                            inputId={`es-${props.label}-${item.value}-checkbox`}
                            value={item.value}
                            checked={item.isRefined || false}
                            onChange={() => refine(item.value)}
                        />
                        {displayLabel(item)}
                    </div>
                    <span>{item.count}</span>
                </div>
            ))}
        </EsFilter>
    );
};

export default EsFacet;
export type { EsFacetProps };
