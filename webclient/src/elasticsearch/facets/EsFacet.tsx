import React, { useState } from "react";
import EsFilter from "../filters/EsFilter";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import { EsContextProps } from "../EsContext";
import { EsFacetBucket } from "../Search";

interface EsFacetProps<T> {
    context: EsContextProps<T>;
    field: string;
    label: string;
    operator?: "and" | "or";
    showLimit?: number;
    onDisplayLabel?: (value: string) => React.ReactNode;
    orderBy?: (a: EsFacetBucket, b: EsFacetBucket) => number;
}

const EsFacet = <T,>({
    context,
    field,
    label,
    operator = "or",
    showLimit = 10,
    onDisplayLabel,
    orderBy,
}: EsFacetProps<T>) => {
    const { t } = useTranslation("elasticsearch");
    const { facets, refineFacet } = context;

    const [isShowingMore, setIsShowingMore] = useState<boolean>(false);

    const facet = facets[field];

    if (!facet) return null;

    const buckets = facet.buckets;
    const canToggleShowMore = buckets.length > showLimit;

    const displayLabel = (bucket) => {
        if (onDisplayLabel) {
            return onDisplayLabel(bucket.key);
        } else {
            return (
                <label htmlFor={`es-${label}-${bucket.key}-checkbox`}>
                    {bucket.key}
                </label>
            );
        }
    };

    return (
        <EsFilter label={label}>
            {(orderBy ? buckets.sort(orderBy) : buckets)
                .slice(0, isShowingMore ? undefined : showLimit)
                .map((bucket) => (
                    <div
                        key={`${field}-${bucket.key}`}
                        className={
                            bucket.isRefined
                                ? "es-facet-value es-active-facet-value"
                                : "es-facet-value"
                        }
                    >
                        <div className="es-checkbox">
                            <Checkbox
                                className={`es-${bucket.key}-checkbox`}
                                inputId={`es-${label}-${bucket.key}-checkbox`}
                                value={bucket.key}
                                checked={bucket.isRefined || false}
                                onChange={() => refineFacet(field, bucket.key)}
                            />
                            {displayLabel(bucket)}
                        </div>
                        <span>{bucket.doc_count}</span>
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
                    onClick={() => setIsShowingMore(!isShowingMore)}
                />
            )}
        </EsFilter>
    );
};

export default EsFacet;
export type { EsFacetProps };
