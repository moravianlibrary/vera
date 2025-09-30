import {
    Button,
    Divider,
    Flex,
    FlexItem,
    Stack,
    StackItem,
    Title,
} from "@patternfly/react-core";
import { Fragment } from "react/jsx-runtime";
import type {
    EsDateRangeFilterConfig,
    EsFilterConfig,
    EsRangeFilterConfig,
    EsSearchFilterConfig,
    EsTermsFilterConfig,
} from "../../models/es";
import { useTranslation } from "react-i18next";
import EsTermsFilter from "../molecules/EsFacetFilter";
import type { EsAggregation } from "../../models/api/responses/es_aggregations";
import type { EsAggregationsRequest } from "../../models/api/requests/es";

interface EsFiltersProps {
    filtersConfig: EsFilterConfig[];
    i18nFieldPrefix: string;
    aggregations: Record<string, EsAggregation>;
    state: EsAggregationsRequest;
    onToggleTerm: (field: string, key: string) => void;
    onSetRange: (field: string, from?: number, to?: number) => void;
    onSetDateRange: (field: string, from?: string, to?: string) => void;
    onSetFieldQuery: (field: string, query: string) => void;
    onApplyFilters: () => void;
    onClearFilters: (field?: string) => void;
}

const EsFilters = ({
    filtersConfig,
    i18nFieldPrefix,
    aggregations,
    state,
    onToggleTerm,
    onSetRange,
    onSetDateRange,
    onSetFieldQuery,
    onApplyFilters,
    onClearFilters,
}: EsFiltersProps) => {
    const { t } = useTranslation();

    console.log(aggregations);

    const renderTermsFilter = (filterConfig: EsTermsFilterConfig) => {
        return (
            <EsTermsFilter
                key={filterConfig.field}
                config={filterConfig}
                buckets={aggregations[filterConfig.field]?.buckets || []}
                selected={
                    (state[filterConfig.field] as EsTermsFilterState)
                        ?.selected ?? []
                }
                onToggle={(bucketKey) =>
                    onToggleTerm(filterConfig.field, bucketKey)
                }
            />
        );
    };

    const renderRangeFilter = (filterConfig: EsRangeFilterConfig) => {
        return <div>Range filter</div>;
    };

    const renderDateRangeFilter = (filterConfig: EsDateRangeFilterConfig) => {
        return <div>Date range filter</div>;
    };

    const renderSearchFilter = (filterConfig: EsSearchFilterConfig) => {
        return <div>Search filter</div>;
    };

    const renderFilter = (filterConfig: EsFilterConfig) => {
        switch (filterConfig.type) {
            case "terms":
                return renderTermsFilter(filterConfig);
            case "range":
                return renderRangeFilter(filterConfig);
            case "date-range":
                return renderDateRangeFilter(filterConfig);
            case "search":
                return renderSearchFilter(filterConfig);
        }
    };

    return (
        <Stack
            style={{
                marginLeft: 30,
                marginRight: 30,
                marginTop: 20,
                marginBottom: 20,
            }}
            hasGutter
        >
            {filtersConfig
                .filter((filterConfig) => aggregations[filterConfig.field])
                .map((filterConfig) => (
                    <Fragment key={filterConfig.field}>
                        <StackItem>
                            <Title headingLevel="h3">
                                {t(`${i18nFieldPrefix}.${filterConfig.field}`)}
                            </Title>
                            <Divider />
                        </StackItem>
                        <StackItem>{renderFilter(filterConfig)}</StackItem>
                    </Fragment>
                ))}
            <StackItem>
                <Divider />
            </StackItem>
            <StackItem>
                <Flex>
                    <FlexItem>
                        <Button variant="primary" onClick={onApplyFilters}>
                            {t("common:actions.apply-filters")}
                        </Button>
                    </FlexItem>
                    <FlexItem>
                        <Button
                            variant="secondary"
                            onClick={() => onClearFilters()}
                        >
                            {t("common:actions.clear-all-filters")}
                        </Button>
                    </FlexItem>
                </Flex>
            </StackItem>
        </Stack>
    );
};

export default EsFilters;
