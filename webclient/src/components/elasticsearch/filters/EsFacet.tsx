import React from "react";
import EsFilter from "./EsFilter";
import { Checkbox } from "primereact/checkbox";
import { RefinementListProps, useRefinementList } from "react-instantsearch";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { orderBy } from "../../../types/DocumentFlag";

interface EsFacetProps extends RefinementListProps {
    label: string;
    onDisplayLabel?: (item) => React.ReactNode;
    orderBy?: (a, b) => number;
}

const EsFacet: React.FC<EsFacetProps> = (props) => {
    const { t } = useTranslation("elasticsearch");
    const {
        items,
        refine,
        canRefine,
        canToggleShowMore,
        isShowingMore,
        toggleShowMore,
    } = useRefinementList(props);

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
            {(props.orderBy
                ? items.sort((a, b) => props.orderBy(a.value, b.value))
                : items
            ).map((item) => (
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
            {canToggleShowMore && (
                <Button
                    className="p-1 mt-2"
                    outlined
                    icon={
                        isShowingMore
                            ? "pi pi-chevron-up"
                            : "pi pi-chevron-down"
                    }
                    label={
                        isShowingMore
                            ? t("facet.show-less")
                            : t("facet.show-more")
                    }
                    onClick={toggleShowMore}
                />
            )}
        </EsFilter>
    );
};

export default EsFacet;
export type { EsFacetProps };
