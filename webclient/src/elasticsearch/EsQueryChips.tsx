import React from "react";
import { Chip } from "primereact/chip";
import { useTranslation } from "react-i18next";
import { EsQuery } from "./Search";
import { EsIndexSettings } from "./IndexSettings";

interface EsQueryChipsProps {
    indexSettings: EsIndexSettings;
    queryParams: EsQuery;
    removeFilterCallback?: (field: string) => void;
}

const EsQueryChips: React.FC<EsQueryChipsProps> = ({
    indexSettings,
    queryParams,
    removeFilterCallback,
}) => {
    const { t } = useTranslation("index");

    const getLabel = (
        attribute: string,
        value: string,
        translateAs: string,
        tType?: string
    ) => {
        const tKey = attribute.replace(/_/g, "-");
        switch (translateAs) {
            case "type":
                return t(`query-params.${tKey}`, {
                    value: t(`${tType}.${value}`, { ns: "types" }),
                });
            case "text":
                return t(`query-params.${tKey}`, { value });
            case "boolean":
            case "structural":
                return t(`query-params.${tKey}.${value}`);
            case "number":
                return t(`query-params.${tKey}`, {
                    value: value.replace(/^\d+:/, ""),
                });
            default:
                return `${tKey}: ${value}`;
        }
    };

    if (
        Object.entries(queryParams).filter(
            ([key, value]) =>
                value !== undefined && value !== null && value !== ""
        ).length === 1
    ) {
        return (
            <div>
                <Chip label={t("query-params.all")} />
            </div>
        );
    }

    return (
        <div className="flex flex-wrap w-min gap-2">
            {"query" in queryParams && queryParams["query"] && (
                <Chip
                    className="white-space-nowrap"
                    key={"query-params-query"}
                    label={t("query-params-query", {
                        ns: "elasticsearch",
                        value: queryParams["query"],
                    })}
                    removable={removeFilterCallback !== undefined}
                    onRemove={() => removeFilterCallback("query")}
                />
            )}
            {indexSettings.facet_attributes
                .filter((fa) => fa.field in queryParams)
                .map((fa, i) => {
                    const value = queryParams[fa.field];
                    return (
                        typeof value === "string" ? value.split(",") : [value]
                    ).map((v, j) => (
                        <Chip
                            className="white-space-nowrap"
                            key={`${i}_${j}`}
                            // label={getLabel(
                            //     fa.field,
                            //     v,
                            //     fa.translateAs,
                            //     fa.tType
                            // )}
                            // removable={removeFilterCallback !== undefined}
                            // onRemove={() => removeFilterCallback(fa.attribute)}
                        />
                    ));
                })}
        </div>
    );
};

export default EsQueryChips;
