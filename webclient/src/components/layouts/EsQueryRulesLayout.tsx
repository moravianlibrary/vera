import React from "react";
import { useTranslation } from "react-i18next";
import LabeledSection from "./LabeledSection";

interface EsQueryRulesLayoutProps {
    sortBy?: React.ReactNode;
    facets: React.ReactNode;
}

const EsQueryRulesLayout: React.FC<EsQueryRulesLayoutProps> = ({
    sortBy,
    facets,
}) => {
    const { t } = useTranslation();

    return (
        <div className="layout-es-query-rules">
            {sortBy && (
                <LabeledSection label={t("common.sort-by")}>
                    {sortBy}
                </LabeledSection>
            )}
            <LabeledSection label={t("common.facets")}>{facets}</LabeledSection>
        </div>
    );
};

export default EsQueryRulesLayout;
