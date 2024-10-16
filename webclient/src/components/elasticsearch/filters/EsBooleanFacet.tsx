import React from "react";
import EsFacet, { EsFacetProps } from "./EsFacet";
import { useTranslation } from "react-i18next";

const EsBooleanFacet: React.FC<EsFacetProps> = ({ attribute, label }) => {
    const { t } = useTranslation("elasticsearch");
    return (
        <EsFacet
            attribute={attribute}
            label={label}
            limit={2}
            sortBy={["name:desc"]}
            transformItems={(items) =>
                items.map((item) => ({
                    ...item,
                    label: item.value === "1" ? t("yes") : t("no"),
                }))
            }
        />
    );
};

export default EsBooleanFacet;
