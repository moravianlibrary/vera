import { TabPanel, TabView } from "primereact/tabview";
import React from "react";
import { useTranslation } from "react-i18next";
import LabeledComponent from "../LabeledComponent";

interface EsQueryRulesLayoutProps {
    sortBy?: React.ReactNode;
    facets?: React.ReactNode;
    filters?: React.ReactNode;
}

const EsQueryRulesLayout: React.FC<EsQueryRulesLayoutProps> = ({
    sortBy,
    facets,
    filters,
}) => {
    const { t } = useTranslation();

    if (!facets && !filters) return null;

    return (
        <div className="layout-es-query-rules">
            {sortBy && (
                <div className="sort-by">
                    <LabeledComponent
                        className="es-sort-by border-1 border-round border-200"
                        label={t("common.sort-by")}
                        column
                    >
                        {sortBy}
                    </LabeledComponent>
                </div>
            )}
            <TabView className="facets-filters">
                {facets && (
                    <TabPanel className="facets" header={t("common.facets")}>
                        {facets}
                    </TabPanel>
                )}
                {filters && (
                    <TabPanel className="filters" header={t("common.filters")}>
                        {filters}
                    </TabPanel>
                )}
            </TabView>
        </div>
    );
};

export default EsQueryRulesLayout;
