import React from "react";
import { useTranslation } from "react-i18next";
import LabeledSection from "./LabeledSection";
import EsQueryParams from "../elasticsearch/EsQueryParams";
import { stateToQuery } from "../../data/factories/EsQueriesFactory";
import { EsContextProps } from "../../elasticsearch/EsContext";
import EsFacet, { EsFacetProps } from "../../elasticsearch/facets/EsFacet";

interface EsQueryRulesLayoutProps<T> {
    context: EsContextProps<T>;
    sortBy?: any;
    facetsProps: Omit<EsFacetProps<T>, "context">[];
}

const EsQueryRulesLayout = <T,>({
    context,
    sortBy,
    facetsProps,
}: EsQueryRulesLayoutProps<T>) => {
    const { t } = useTranslation("elasticsearch");

    return (
        <div className="layout-es-query-rules">
            {sortBy && (
                <LabeledSection label={t("sort-by")}>{sortBy}</LabeledSection>
            )}
            <LabeledSection label={t("facets")}>
                {facetsProps.map((facet) => (
                    <EsFacet {...facet} context={context} />
                ))}
            </LabeledSection>
            {/* {queryParamsIndexName && (
                <LabeledSection label={t("query-params")}>
                    <EsQueryParams queryParams={stateToQuery(uiState)} />
                </LabeledSection>
            )} */}
        </div>
    );
};

export default EsQueryRulesLayout;
