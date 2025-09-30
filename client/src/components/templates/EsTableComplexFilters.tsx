import { Fragment } from "react/jsx-runtime";
import EsHitsTable from "../molecules/EsTable";
import {
    Pagination,
    SearchInput,
    Toolbar,
    ToolbarContent,
    ToolbarGroup,
    ToolbarItem,
    type PerPageOptions,
} from "@patternfly/react-core";
import BulkSelector, {
    type BulkSelectorTexts,
} from "../molecules/BulkSelector";
import EsFilters from "../organisms/EsFilters";
import { useEffect, useReducer, useState } from "react";
import type { EsFilterConfig } from "../../models/es";
import type { TableColumnConfig } from "../../models/config";
import EsFilterPresetsDropdown, {
    type EsFilterPresetsDropdownTexts,
} from "../molecules/EsFilterPresetsDropdown";
import { SortingIcon } from "../atoms/Icons";
import ActionsMenu from "../molecules/ActionsMenu";
import type {
    ActionConfig,
    EsSortOption,
    StaticUiText,
} from "../../models/ui/config";
import ToggleFiltersButton from "../molecules/ToggleFiltersButton";
import { FilterIcon } from "@patternfly/react-icons";
import { requestReducer } from "../../store/reducers/es";
import type { EsRequest } from "../../models/api/requests/es";
import { selectPage, selectPerPage } from "../../store/selectors/es";
import type { EsSearchConfig } from "../../store/domains/es";
import type { UseQueryResult } from "@tanstack/react-query";
import type { EsDocumentResponse } from "../../models/document";
import SingleSelect from "../molecules/SingleSelect";
import LoadingState from "../atoms/LoadingState";
import NoMatchFoundState from "../atoms/NoMatchFoundState";

interface EsTableComplexFiltersProps {
    // config
    columnConfigs: TableColumnConfig[];
    searchConfig: EsSearchConfig;
    filterConfigs: EsFilterConfig[];
    sortOptions: EsSortOption[];
    actionsConfig: ActionConfig[];
    perPageOptions?: PerPageOptions[];
    uiConfig?: any;
    initState: any;
    useItemsSource: (
        requests: EsRequest[]
    ) => UseQueryResult<EsDocumentResponse, unknown>[];
    texts: {
        bulkSelector: BulkSelectorTexts;
        actionsMenuLabel: StaticUiText;
        searchBarPlaceholder: StaticUiText;
        filters: {
            label: StaticUiText;
            labelExpanded?: StaticUiText;
        };
        filterPresets: EsFilterPresetsDropdownTexts;
        paginator: {
            perPageSuffix: StaticUiText;
            ofWord: StaticUiText;
        };
    };
}

const EsTableComplexFilters = ({
    columnConfigs,
    filterConfigs,
    sortOptions,
    actionsConfig,
    perPageOptions,
    uiConfig,
    initState,
    searchConfig,
    useItemsSource,
    texts,
}: EsTableComplexFiltersProps) => {
    const [state, dispatch] = useReducer(requestReducer, initState);

    const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);

    const { data, isLoading, isError, error } = useItemsSource(
        state.requests
    ).reduce(
        (acc, result) => {
            if (result.isLoading) {
                acc.isLoading = true;
            }
            if (result.isError) {
                acc.isError = true;
                acc.error = result.error as Error;
            }
            if (result.data) {
                acc.data = result.data;
            }
            return acc;
        },
        {
            data: undefined as EsDocumentResponse | undefined,
            isLoading: false,
            isError: false,
            error: null as Error | null,
        }
    );

    const hits = data?.hits.hits || [];
    const totalItems = data?.hits.total.value || 0;
    const aggregations = data?.aggregations || {};
    const page = selectPage(state);
    const perPage = selectPerPage(state);
    const searchTerm = state.searchTerm;
    const filterStates = state.filterStates;
    const hasActiveFilters =
        searchTerm || Object.values(filterStates ?? {}).length > 0;
    const selectedIds = state.selectedIds;
    const isAllSelected = state.isAllSelected;
    const columnStates = state.columnStates;

    // useEffect(() => {
    //     dispatch({ type: "setPageIds", ids: hits?.map((h) => h._id) || [] });
    // }, [hits]);

    // TODO: Columns settings button that will switch table or filters view to columns settings view
    // TODO: Predefined columns sets - either under settings button or as a dropdown
    // TODO: Paginator at the bottom floating above the table
    // TODO: Sorting options somewhere

    const bulkSelector = (
        <BulkSelector
            selectedCount={isAllSelected ? totalItems : selectedIds.size}
            onPageCount={hits.length}
            totalCount={totalItems}
            onSelectNone={() => dispatch({ type: "clearSelection" })}
            onSelectPage={() => dispatch({ type: "selectPage" })}
            onSelectAll={() => dispatch({ type: "selectAll" })}
            texts={texts.bulkSelector}
        />
    );

    const actionsMenu = (
        <ActionsMenu
            config={actionsConfig}
            label={texts.actionsMenuLabel}
            disabled={selectedIds?.size === 0}
        />
    );

    const bulkActionsControls = (
        <ToolbarGroup key="bulk-actions" align={{ default: "alignStart" }}>
            <ToolbarItem>{bulkSelector}</ToolbarItem>
            <ToolbarItem>{actionsMenu}</ToolbarItem>
        </ToolbarGroup>
    );

    const searchBar = (
        <SearchInput
            placeholder={texts.searchBarPlaceholder}
            value={searchTerm}
            onChange={(_event, value) =>
                dispatch({ type: "setSearchTerm", value })
            }
            onClear={() => dispatch({ type: "clearSearch" })}
            onSearch={() =>
                dispatch({ type: "submitSearch", config: searchConfig })
            }
        />
    );

    const searchControls = (
        <ToolbarGroup key="search" align={{ default: "alignCenter" }}>
            <ToolbarItem>{searchBar}</ToolbarItem>
        </ToolbarGroup>
    );

    const toggleFiltersButton = (
        <ToggleFiltersButton
            icon={<FilterIcon />}
            expanded={isFiltersExpanded}
            onToggle={() => setIsFiltersExpanded(!isFiltersExpanded)}
            label={texts.filters.label}
            labelExpanded={texts.filters.labelExpanded}
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
            onSelect={() => {}}
            onSave={() => {}}
            onDelete={() => {}}
            onToggleFavorite={() => {}}
            // onFilterChange={(field, newState) => {
            //     dispatch({ type: "setFilter", field, newState });
            // }}
            texts={texts.filterPresets}
        />
    );

    const sorting = (
        <SingleSelect
            icon={<SortingIcon />}
            options={sortOptions.map((opt) => opt.label as string)}
            selected={state.sortBy?.label || sortOptions[0].label}
            onSelect={(label) =>
                dispatch({
                    type: "setSortBy",
                    option: sortOptions.find((o) => o.label === label)!,
                })
            }
        />
    );

    const filterControls = (
        <ToolbarGroup key="filters" align={{ default: "alignEnd" }}>
            <ToolbarItem>{toggleFiltersButton}</ToolbarItem>
            <ToolbarItem>{filterPresets}</ToolbarItem>
            <ToolbarItem>{sorting}</ToolbarItem>
        </ToolbarGroup>
    );

    const controls = (
        <Toolbar
            isSticky
            style={{ marginTop: 0, marginLeft: 30, marginRight: 30 }}
        >
            <ToolbarContent rowWrap={{ default: "nowrap" }}>
                {bulkActionsControls}
                {searchControls}
                {filterControls}
            </ToolbarContent>
        </Toolbar>
    );

    const filters = (
        <EsFilters
            filtersConfig={filterConfigs}
            i18nFieldPrefix=""
            aggregations={aggregations}
            state={{
                status: { selected: ["new"], query: "" },
                category_id: { selected: [], query: "" },
            }}
            onToggleTerm={(field, bucketKey) =>
                dispatch({ type: "toggleTerm", field, bucketKey })
            }
            onSetRange={(field, from, to) =>
                dispatch({ type: "setRange", field, from, to })
            }
            onSetDateRange={(field, from, to) =>
                dispatch({ type: "setDateRange", field, from, to })
            }
            onSetFieldQuery={(field, query) =>
                dispatch({ type: "setFieldQuery", field, query })
            }
            onApplyFilters={() => setIsFiltersExpanded(false)}
            onClearFilters={(field) =>
                dispatch({ type: "clearFilters", field })
            }
        />
    );

    const getTableState = () => {
        if (isLoading) {
            return <LoadingState title="Loading results..." />;
        }
        if (totalItems === 0 && hasActiveFilters) {
            return (
                <NoMatchFoundState
                    titleText="No results found"
                    bodyText="Try adjusting your search or filter to find what you're looking for."
                    clearFiltersText="Clear all filters"
                    onClearFilters={() => dispatch({ type: "clearFilters" })}
                />
            );
        }
    };

    const table = (
        <EsHitsTable
            columns={columnConfigs}
            columnStates={columnStates}
            tableState={getTableState()}
            hits={hits}
            selectedIds={selectedIds}
            onToggleSelect={(id) =>
                dispatch({ type: "toggleSelection", id: id })
            }
        />
    );

    const paginator = (
        <Pagination
            style={{ marginLeft: 30, marginRight: 30 }}
            perPageOptions={perPageOptions}
            itemCount={totalItems}
            page={page}
            perPage={perPage}
            onSetPage={(_event, newPage, newPerPage) => {
                dispatch({
                    type: "setPaginationParams",
                    page: newPage,
                    perPage: newPerPage || perPage || 0,
                });
            }}
            onPerPageSelect={(_event, newPerPage, newPage) => {
                dispatch({
                    type: "setPaginationParams",
                    page: newPage,
                    perPage: newPerPage,
                });
            }}
            variant="bottom"
            isSticky
            titles={{
                perPageSuffix: texts.paginator.perPageSuffix,
                ofWord: texts.paginator.ofWord,
            }}
        />
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
