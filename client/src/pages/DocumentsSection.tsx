import { useReducer, type ReactElement } from "react";
import type { EsFilterConfig } from "../models/es";
import { useSearchDocuments } from "../hooks/useDocuments";
import EsTableComplexFilters from "../components/templates/EsTableComplexFilters";
import type { TableColumnConfig } from "../models/config";
import type { Document } from "../models/document";
import { selectPage, selectPerPage } from "../store/selectors/es";
import { requestReducer } from "../store/reducers/es";
import { initEsPageState, type EsSearchConfig } from "../store/domains/es";

const columnConfigs: TableColumnConfig<Document>[] = [
    {
        key: "catalog_record_id",
        render: (data: Partial<Document>) => <>{data.catalog_record_id}</>,
        visibleByDefault: true,
    },
    {
        key: "iteration",
        render: (data: Partial<Document>) => <>{data.iteration}</>,
    },
    {
        key: "material_type",
        render: (data: Partial<Document>) => <>{data.material_type}</>,
        visibleByDefault: true,
    },
    {
        key: "title",
        render: (data: Partial<Document>) => <>{data.title}</>,
        visibleByDefault: true,
    },
    {
        key: "volume_number",
        render: (data: Partial<Document>) => <>{data.volume_number}</>,
    },
    {
        key: "volume_year",
        render: (data: Partial<Document>) => <>{data.volume_year}</>,
    },
    {
        key: "bundle",
        render: (data: Partial<Document>) => <>{data.bundle}</>,
    },
    {
        key: "barcode",
        render: (data: Partial<Document>) => <>{data.barcode}</>,
    },
    {
        key: "issuance_type",
        render: (data: Partial<Document>) => <>{data.issuance_type}</>,
    },
    {
        key: "digitization_state",
        render: (data: Partial<Document>) => <>{data.digitization_state}</>,
    },
    {
        key: "page_count_manual",
        render: (data: Partial<Document>) => <>{data.page_count_manual}</>,
    },
    {
        key: "page_count",
        render: (data: Partial<Document>) => <>{data.page_count}</>,
    },
    {
        key: "category_id",
        render: (data: Partial<Document>) => <>{data.category_id}</>,
    },
    {
        key: "priority",
        render: (data: Partial<Document>) => <>{data.priority}</>,
    },
    {
        key: "digitization_list_id",
        render: (data: Partial<Document>) => <>{data.digitization_list_id}</>,
    },
    {
        key: "digitization_list_state",
        render: (data: Partial<Document>) => (
            <>{data.digitization_list_state}</>
        ),
    },
    {
        key: "current_status",
        alwaysShow: true,
        render: (data: Partial<Document>) => <>{data.current_status}</>,
    },
    {
        key: "created_by",
        render: (data: Partial<Document>) => <>{data.created_by}</>,
    },
    // {
    //     key: "created_at",
    //     render: (data: Partial<Document>) => <>{data.created_at}</>,
    // },
    // {
    //     key: "updated_at",
    //     render: (data: Partial<Document>) => <>{data.updated_at}</>,
    // },
];

const searchConfig: EsSearchConfig = {
    fields: [
        "catalog_record_id",
        "title",
        "volume_number",
        "volume_year",
        "bundle",
        "barcode",
    ],
};

const filterConfigs: EsFilterConfig[] = [
    { field: "status", type: "terms" },
    { field: "category_id", type: "terms" },
];

const DocumentsSection = (): ReactElement => {
    const [state, dispatch] = useReducer(requestReducer, initEsPageState());

    const { data, isLoading, isError, error } = useSearchDocuments(
        state.request
    );

    return (
        <EsTableComplexFilters
            isLoading={isLoading}
            isError={isError}
            error={error}
            columnConfigs={columnConfigs}
            columnOrder={[]}
            filterConfigs={filterConfigs}
            actionsConfig={[
                {
                    label: "export",
                    actions: [
                        { label: "CSV", onClick: () => {} },
                        { label: "Excel", onClick: () => {} },
                    ],
                },
                {
                    label: "change-category",
                    actions: [
                        {
                            label: "Category 1",
                            actions: [
                                {
                                    label: "Subcategory 1.1",
                                    actions: [
                                        {
                                            label: "Subcategory 1.1.1",
                                            onClick: () => {},
                                        },
                                        {
                                            label: "Subcategory 1.1.2",
                                            actions: [
                                                {
                                                    label: "Subcategory 1.1.2.1",
                                                    onClick: () => {},
                                                },
                                                {
                                                    label: "Subcategory 1.1.2.2",
                                                    onClick: () => {},
                                                },
                                            ],
                                        },
                                    ],
                                },
                                { label: "Subcategory 1.2", onClick: () => {} },
                                { label: "Subcategory 1.3", onClick: () => {} },
                            ],
                        },
                        {
                            label: "Category 2",
                            actions: [
                                { label: "Subcategory 2.1", onClick: () => {} },
                                { label: "Subcategory 2.2", onClick: () => {} },
                            ],
                        },
                        { label: "Category 3", onClick: () => {} },
                    ],
                },
            ]}
            uiConfig={{}}
            i18nPrefix=""
            hits={data?.hits.hits}
            aggregations={data?.aggregations}
            totalItems={data?.hits.total.value}
            page={selectPage(state)}
            perPage={selectPerPage(state)}
            searchTerm={state.searchTerm}
            filterStates={state.filterStates}
            isAllSelected={state.isAllSelected}
            selectedIds={state.selectedIds}
            onPageChange={(newPage, newPerPage) =>
                dispatch({
                    type: "setPagination",
                    page: newPage,
                    perPage: newPerPage,
                })
            }
            onSearchChange={(value) =>
                dispatch({ type: "setSearchTerm", value })
            }
            onSearchClear={() => dispatch({ type: "clearSearch" })}
            onSearchSubmit={() =>
                dispatch({ type: "submitSearch", config: searchConfig })
            }
            onFilterChange={(field, newState) => {
                dispatch({ type: "setFilter", field, newState });
            }}
            onToggleSelect={(id) =>
                dispatch({ type: "toggleSelection", id: id })
            }
            onSelectNone={() => dispatch({ type: "clearSelection" })}
            onSelectPage={() => dispatch({ type: "selectPage" })}
            onSelectAll={() => dispatch({ type: "selectAll" })}
        />
    );
};

export default DocumentsSection;
