import { Fragment } from "react/jsx-runtime";
import EsHitsTable from "../molecules/EsTable";
import {
    Button,
    Divider,
    Flex,
    FlexItem,
    Pagination,
    SearchInput,
    type PerPageOptions,
} from "@patternfly/react-core";
import BulkSelector from "../molecules/BulkSelector";
import EsFilters, { type EsFilterState } from "../organisms/EsFilters";
import { FilterIcon } from "@patternfly/react-icons";
import { useState } from "react";
import type { EsFilterConfig } from "../../models/es";
import type { TableColumnConfig } from "../../models/config";
import type {
    EsAggregation,
    EsAggregationBucket,
} from "../../models/api/responses/es_aggregations";
import type { EsHit } from "../../models/api/responses/es";

interface EsTableComplexFiltersProps<T> {
    // config
    columnConfigs: TableColumnConfig<T>[];
    columnOrder?: string[];
    filterConfigs: EsFilterConfig[];
    perPageOptions?: PerPageOptions[];
    uiConfig?: any;
    i18nPrefix: string;

    // loading state
    isLoading: boolean;
    isError: boolean;
    error: Error | null;

    // data
    hits?: Array<EsHit<T>>;
    aggregations?: Record<string, EsAggregation>;
    totalItems?: number;

    // state
    page?: number;
    perPage?: number;
    searchTerm: string;
    filterStates?: EsFilterState;

    isAllSelected: boolean;
    selectedIds: Set<string>;

    // callbacks
    onPageChange: (page: number, perPage: number) => void;
    onSearchChange: (value: string) => void;
    onSearchClear: () => void;
    onSearchSubmit: () => void;
    onFilterChange: (field: string, newState: EsFilterState) => void;

    // callbacks - selection
    onToggleSelect: (id: string) => void;
    onSelectNone: () => void;
    onSelectPage: () => void;
    onSelectAll: () => void;
}

const EsTableComplexFilters = <T,>({
    columnConfigs,
    columnOrder,
    filterConfigs,
    perPageOptions,
    uiConfig,
    i18nPrefix,
    isLoading,
    isError,
    error,
    hits,
    aggregations,
    totalItems,
    page,
    perPage,
    searchTerm,
    filterStates,
    isAllSelected,
    selectedIds,
    onPageChange,
    onSearchChange,
    onSearchClear,
    onSearchSubmit,
    onFilterChange,
    onSelectNone,
    onSelectPage,
    onSelectAll,
    onToggleSelect,
}: EsTableComplexFiltersProps<T>) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);

    if (isLoading) {
        return <>Loading...</>;
    }

    if (isError) {
        return <>Error: {error?.message}</>;
    }

    if (!hits || !totalItems || !page || !perPage) {
        throw new Error(
            `EsTableComplexFilters: Missing required data. ` +
                `Debug info — hits: ${!!hits}, totalItems: ${!!totalItems}, ` +
                `page: ${!!page}, perPage: ${!!perPage}`
        );
    }

    return (
        <Fragment>
            <Flex>
                <FlexItem spacer={{ default: "spacerMd" }}>
                    <SearchInput
                        placeholder="Search using catalog..."
                        value={searchTerm}
                        onChange={(_event, value) => onSearchChange(value)}
                        onClear={onSearchClear}
                        onSearch={onSearchSubmit}
                        expandableInput={{
                            isExpanded: isSearchExpanded,
                            onToggleExpand: () =>
                                setIsSearchExpanded(!isSearchExpanded),
                            toggleAriaLabel: "Expandable search input toggle",
                            hasAnimations: true,
                        }}
                    />
                </FlexItem>
                {aggregations && (
                    <FlexItem>
                        <Button variant="plain" icon={<FilterIcon />} />
                    </FlexItem>
                )}
                {/* <TypeheadSelect
                        options={["Option 1", "Option 2", "Option 3"]}
                        placeholder="Select an option"
                        onSelect={() => {}}
                    /> */}
            </Flex>
            {aggregations && (
                <EsFilters
                    filtersConfig={filterConfigs}
                    i18nFieldPrefix={`${i18nPrefix}.fields`}
                    // aggregations={aggregations}
                    buckets={{}}
                    state={{
                        status: { selected: ["new"], query: "" },
                        category_id: { selected: [], query: "" },
                    }}
                />
            )}
            <BulkSelector
                selectedCount={isAllSelected ? totalItems : selectedIds.size}
                onPageCount={hits.length}
                totalCount={totalItems}
                onSelectNone={onSelectNone}
                onSelectPage={onSelectPage}
                onSelectAll={onSelectAll}
            />
            <Pagination
                perPageOptions={perPageOptions}
                itemCount={totalItems}
                page={page}
                perPage={perPage}
                onSetPage={(_event, newPage, newPerPage) => {
                    onPageChange(newPage, newPerPage || perPage);
                }}
                onPerPageSelect={(_event, newPerPage, newPage) => {
                    onPageChange(newPage, newPerPage);
                }}
                variant="top"
                isSticky
            />
            <EsHitsTable columns={columnConfigs} hits={hits} />
        </Fragment>
    );
};

export default EsTableComplexFilters;
