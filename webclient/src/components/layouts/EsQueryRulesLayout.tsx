import React from "react";
import { useTranslation } from "react-i18next";
import LabeledSection from "./LabeledSection";
import { useInstantSearch } from "react-instantsearch";
import EsQueryParams from "../elasticsearch/EsQueryParams";
import { stateToQuery } from "../../data/factories/EsQueriesFactory";

interface EsQueryRulesLayoutProps {
    sortBy?: React.ReactNode;
    facets: React.ReactNode;
    queryParamsIndexName?: string;
}

const EsQueryRulesLayout: React.FC<EsQueryRulesLayoutProps> = ({
    sortBy,
    facets,
    queryParamsIndexName,
}) => {
    const { t } = useTranslation("elasticsearch");
    const { uiState } = useInstantSearch();

    return (
        <div className="layout-es-query-rules">
            {sortBy && (
                <LabeledSection label={t("sort-by")}>{sortBy}</LabeledSection>
            )}
            <LabeledSection label={t("facets")}>{facets}</LabeledSection>
            {queryParamsIndexName && (
                <LabeledSection label={t("query-params")}>
                    <EsQueryParams
                        queryParams={stateToQuery(
                            queryParamsIndexName,
                            uiState
                        )}
                    />
                </LabeledSection>
            )}
        </div>
    );
};

export default EsQueryRulesLayout;
