import { Fragment } from "react/jsx-runtime";
import EsHitsTable from "../molecules/EsTable";
import {
    Flex,
    Pagination,
    SearchInput,
    Toolbar,
    ToolbarContent,
    ToolbarGroup,
    ToolbarItem,
    type PerPageOptions,
} from "@patternfly/react-core";
import BulkSelector from "../molecules/BulkSelector";
import EsFilters, { type EsFilterState } from "../organisms/EsFilters";
import { use, useState } from "react";
import type { EsFilterConfig } from "../../models/es";
import type { TableColumnConfig } from "../../models/config";
import type { EsAggregation } from "../../models/api/responses/es_aggregations";
import type { EsHit } from "../../models/api/responses/es";
import EsFilterPresetsDropdown from "../molecules/EsFilterPresetsDropdown";
import SelectOptions from "../molecules/SelectOptions";
import { SortingIcon } from "../atoms/Icons";
import ActionsMenu from "../molecules/ActionsMenu";
import type { ActionConfig } from "../../models/ui/config";
import ToggleFiltersButton from "../molecules/ToggleFiltersButton";
import { FilterIcon } from "@patternfly/react-icons";
import { useTranslation } from "react-i18next";

interface EsTableComplexFiltersProps<T> {
    // config
    columnConfigs: TableColumnConfig<T>[];
    columnOrder?: string[];
    filterConfigs: EsFilterConfig[];
    actionsConfig: ActionConfig[];
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
    actionsConfig,
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
    const { t } = useTranslation();

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

    const bulkSelector = (
        <ToolbarItem>
            <BulkSelector
                selectedCount={isAllSelected ? totalItems : selectedIds.size}
                onPageCount={hits.length}
                totalCount={totalItems}
                onSelectNone={onSelectNone}
                onSelectPage={onSelectPage}
                onSelectAll={onSelectAll}
                labels={{
                    selectNone: t("common.controls.select-none"),
                    selectPage: (values) =>
                        t("common.controls.select-page", values),
                    selectAll: (values) =>
                        t("common.controls.select-all", values),
                    selectedCount: (values) =>
                        t("common.controls.selected-count", values),
                }}
            />
        </ToolbarItem>
    );

    const actionsMenu = (
        <ToolbarItem>
            <ActionsMenu
                config={actionsConfig}
                label={t("documents.controls.actions-menu-label")}
            />
        </ToolbarItem>
    );

    const bulkActionsControls = (
        <ToolbarGroup key="bulk-actions" align={{ default: "alignStart" }}>
            {bulkSelector}
            {actionsMenu}
        </ToolbarGroup>
    );

    const searchBar = (
        <ToolbarItem>
            <SearchInput
                placeholder={t("documents.controls.search-placeholder")}
                value={searchTerm}
                onChange={(_event, value) => onSearchChange(value)}
                onClear={onSearchClear}
                onSearch={onSearchSubmit}
            />
        </ToolbarItem>
    );

    const searchControls = (
        <ToolbarGroup key="search" align={{ default: "alignCenter" }}>
            {searchBar}
        </ToolbarGroup>
    );

    const toggleFiltersButton = (
        <ToggleFiltersButton
            label={t("common.controls.show-filters")}
            icon={<FilterIcon />}
            labelExpanded={t("common.controls.hide-filters")}
            expanded={isFiltersExpanded}
            onToggle={() => setIsFiltersExpanded(!isFiltersExpanded)}
        />
    );

    const filterPresets = (
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
            labels={{
                placeholder: t("documents.controls.filter-presets.placeholder"),
                favoriteGroup: t(
                    "documents.controls.filter-presets.favorite-group"
                ),
                systemPresetsGroup: t(
                    "documents.controls.filter-presets.system-group"
                ),
                userPresetsGroup: t(
                    "documents.controls.filter-presets.user-group"
                ),
                actionsGroup: t(
                    "documents.controls.filter-presets.actions-group"
                ),
                saveCurrentAction: t(
                    "documents.controls.filter-presets.save-current-action"
                ),
                saveCurrentPrompt: t(
                    "documents.controls.filter-presets.save-current-prompt"
                ),
            }}
            onSelect={() => {}}
            onSave={() => {}}
            onDelete={() => {}}
            onToggleFavorite={() => {}}
        />
    );

    const sorting = (
        <SelectOptions
            options={["Option 1", "Option 2", "Option 3"]}
            icon={<SortingIcon />}
            selected="Option 1"
            placeholder={t("common.controls.sorting.placeholder")}
            onSelect={() => {}}
        />
    );

    const filterControls = (
        <ToolbarGroup key="filters" align={{ default: "alignEnd" }}>
            {toggleFiltersButton}
            {filterPresets}
            {sorting}
        </ToolbarGroup>
    );

    const controls = (
        <Toolbar>
            <ToolbarContent>
                {bulkActionsControls}
                {searchControls}
                {filterControls}
            </ToolbarContent>
        </Toolbar>
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
                    {table}
                    {paginator}
                </Fragment>
            )}
        </Fragment>
    );
};

export default EsTableComplexFilters;
