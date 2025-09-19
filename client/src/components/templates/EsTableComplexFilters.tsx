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
import { FilterIcon, TimesIcon } from "@patternfly/react-icons";
import { useState } from "react";
import type { EsFilterConfig } from "../../models/es";
import type { TableColumnConfig } from "../../models/config";
import type {
    EsAggregation,
    EsAggregationBucket,
} from "../../models/api/responses/es_aggregations";
import type { EsHit } from "../../models/api/responses/es";
import EsFilterPresetsDropdown from "../organisms/EsFilterPresetsDropdown";
import SelectOptions from "../molecules/SelectOptions";
import { SortingIcon } from "../atoms/Icons";
import ActionsMenu from "../molecules/ActionsMenu";

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
    totalItems?: number;
    aggregations?: Record<string, EsAggregation>;

    // state
    page?: number;
    perPage?: number;
    searchTerm: string;
    filterStates?: EsFilterState;
    predefinedFilters?: Record<string, EsFilterState>;

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
    totalItems,
    aggregations,
    page,
    perPage,
    searchTerm,
    filterStates,
    predefinedFilters,
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
    const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);

    if (isLoading) {
        return <>Loading...</>;
    }

    if (isError) {
        return <>Error: {error?.message}</>;
    }

    if (!hits || !totalItems || !aggregations || !page || !perPage) {
        throw new Error(
            `EsTableComplexFilters: Missing required data. ` +
                `Debug info — hits: ${!!hits}, totalItems: ${!!totalItems}, ` +
                `aggregations: ${!!aggregations}, page: ${!!page}, perPage: ${!!perPage}`
        );
    }

    // TODO: Columns settings button that will switch table or filters view to columns settings view
    // TODO: Predefined columns sets - either under settings button or as a dropdown
    // TODO: Paginator at the bottom floating above the table
    // TODO: Sorting options somewhere

    const controls = (
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
            <FlexItem spacer={{ default: "spacerMd" }}>
                {/* TODO: If both buttons will by used, make molecule out of them */}
                <Button
                    variant="plain"
                    icon={<FilterIcon />}
                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                />
                {isFiltersExpanded && (
                    <Button
                        variant="plain"
                        icon={<TimesIcon />}
                        onClick={() => setIsFiltersExpanded(false)}
                    />
                )}
            </FlexItem>
            <FlexItem>
                <EsFilterPresetsDropdown
                    systemPresets={[
                        {
                            id: "1",
                            name: "System preset 1",
                            filters: {},
                        },
                        {
                            id: "2",
                            name: "System preset 2",
                            filters: {},
                        },
                    ]}
                    userPresets={[
                        { id: "3", name: "User preset 1", filters: {} },
                        { id: "4", name: "User preset 2", filters: {} },
                    ]}
                    hasActiveFilters={false}
                    onSelect={() => {}}
                    onSave={() => {}}
                    onDelete={() => {}}
                    onToggleFavorite={() => {}}
                />
            </FlexItem>
            <FlexItem>
                <SelectOptions
                    options={["Option 1", "Option 2", "Option 3"]}
                    icon={<SortingIcon />}
                    placeholder="Select an option"
                    compact
                    selected="Option 1"
                    onSelect={() => {}}
                />
            </FlexItem>
            {/* <TypeheadSelect
                        options={["Option 1", "Option 2", "Option 3"]}
                        placeholder="Select an option"
                        onSelect={() => {}}
                    /> */}
            {/* Also add sorting options here */}
        </Flex>
    );

    const filters = (
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
    );

    const bulkActions = (
        <Flex>
            <FlexItem>
                <BulkSelector
                    selectedCount={
                        isAllSelected ? totalItems : selectedIds.size
                    }
                    onPageCount={hits.length}
                    totalCount={totalItems}
                    onSelectNone={onSelectNone}
                    onSelectPage={onSelectPage}
                    onSelectAll={onSelectAll}
                />
            </FlexItem>
            <ActionsMenu
                config={[]}
                disabled={!isAllSelected && !selectedIds.size}
            />
        </Flex>
    );

    const table = <EsHitsTable columns={columnConfigs} hits={hits} />;

    const paginator = (
        <Flex>
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
        </Flex>
    );

    return (
        <Fragment>
            {controls}
            {isFiltersExpanded && filters}
            {!isFiltersExpanded && (
                <Fragment>
                    {bulkActions}
                    {table}
                    {paginator}
                </Fragment>
            )}
        </Fragment>
    );
};

export default EsTableComplexFilters;
