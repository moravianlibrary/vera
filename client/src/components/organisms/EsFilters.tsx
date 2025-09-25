import { Content, Divider } from "@patternfly/react-core";
import { Fragment } from "react/jsx-runtime";
import type { EsFilterConfig } from "../../models/es";
import { useTranslation } from "react-i18next";
import EsTermsFilter from "../molecules/EsFacetFilter";
import type { EsAggregationBucket } from "../../models/api/responses/es_aggregations";

interface EsFacetFilterState {
    selected: string[];
}

interface EsRangeFilterState {
    from?: number;
    to?: number;
}

interface EsDateRangeFilterState {
    from?: string;
    to?: string;
}

interface EsSearchFilterState {
    query: string;
}

export interface EsFilterState {
    [field: string]:
        | EsFacetFilterState
        | EsRangeFilterState
        | EsDateRangeFilterState
        | EsSearchFilterState;
}

interface EsFiltersProps {
    filtersConfig: EsFilterConfig[];
    i18nFieldPrefix: string;
    buckets: Record<string, EsAggregationBucket[]>;
    state: EsFilterState;
    onChange?: (action: EsFilterAction) => void;
}

type EsFilterAction =
    | { type: "toggle_facet"; field: string; key: string }
    | { type: "set_range"; field: string; from?: number; to?: number }
    | { type: "set_date_range"; field: string; from?: string; to?: string }
    | { type: "set_query"; field: string; query: string }
    | { type: "clear"; field?: string };

const renderFilter = (
    filterConfig: EsFilterConfig,
    buckets: EsAggregationBucket[],
    state: EsFilterState
) => {
    switch (filterConfig.type) {
        case "terms":
            return (
                <EsTermsFilter
                    key={filterConfig.field}
                    config={filterConfig}
                    buckets={buckets}
                    selected={
                        (state[filterConfig.field] as EsFacetFilterState)
                            .selected
                    }
                    onToggle={() => {}}
                />
            );
        case "range":
            return <div>Range filter</div>;
        case "date-range":
            return <div>Date range filter</div>;
        case "search":
            return <div>Search filter</div>;
        default:
            return null;
    }
};

const EsFilters = ({
    filtersConfig,
    i18nFieldPrefix,
    buckets,
    state,
}: EsFiltersProps) => {
    const { t } = useTranslation();

    return (
        <Fragment>
            {filtersConfig
                .filter((filterConfig) => buckets[filterConfig.field])
                .map((filterConfig) => (
                    <Fragment key={filterConfig.field}>
                        <Content component="h3">
                            {t(`${i18nFieldPrefix}.${filterConfig.field}`)}
                        </Content>
                        <Divider />
                        {renderFilter(
                            filterConfig,
                            buckets[filterConfig.field],
                            state
                        )}
                    </Fragment>
                ))}
        </Fragment>
    );
};

export default EsFilters;
