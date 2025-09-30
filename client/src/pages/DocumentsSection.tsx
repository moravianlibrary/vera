import { type ReactElement } from "react";
import type { EsFilterConfig } from "../models/es";
import {
    useSearchDocuments,
    useSearchDocumentsBatch,
} from "../hooks/useDocuments";
import EsTableComplexFilters from "../components/templates/EsTableComplexFilters";
import type { TableColumnConfig } from "../models/config";
import type { Document } from "../models/document";
import { initEsPageState, type EsSearchConfig } from "../store/domains/es";
import { useTranslation } from "react-i18next";
import type { ActionConfig, EsSortOption } from "../models/ui/config";
import { type TFunction } from "i18next";

function getColumnConfigs(t: TFunction): TableColumnConfig[] {
    return [
        {
            key: "catalog_record_id",
            label: t("documents:properties.catalog-record-id"),
            render: (data: Partial<Document>) => <>{data.catalog_record_id}</>,
            visibleByDefault: true,
        },
        {
            key: "iteration",
            label: t("documents:properties.iteration"),
        },
        {
            key: "document-type",
            label: t("documents:properties.document-type"),
            render: (data: Partial<Document>) => <>{data.material_type}</>,
            visibleByDefault: true,
        },
        {
            key: "title",
            label: t("documents:properties.title"),
            render: (data: Partial<Document>) => <>{data.title}</>,
            visibleByDefault: true,
        },
        {
            key: "volume_number",
            label: t("documents:properties.volume_number"),
            render: (data: Partial<Document>) => <>{data.volume_number}</>,
        },
        {
            key: "volume_year",
            label: t("documents:properties.volume_year"),
            render: (data: Partial<Document>) => <>{data.volume_year}</>,
        },
        {
            key: "bundle",
            label: t("documents:properties.bundle"),
            render: (data: Partial<Document>) => <>{data.bundle}</>,
        },
        {
            key: "barcode",
            label: t("documents:properties.barcode"),
            render: (data: Partial<Document>) => <>{data.barcode}</>,
        },
        {
            key: "issuance_type",
            label: t("documents:properties.issuance_type"),
            render: (data: Partial<Document>) => <>{data.issuance_type}</>,
        },
        {
            key: "digitization_state",
            label: t("documents:properties.digitization_state"),
            render: (data: Partial<Document>) => <>{data.digitization_state}</>,
        },
        {
            key: "page_count_manual",
            label: t("documents:properties.page_count_manual"),
            render: (data: Partial<Document>) => <>{data.page_count_manual}</>,
        },
        {
            key: "page_count",
            label: t("documents:properties.page_count"),
            render: (data: Partial<Document>) => <>{data.page_count}</>,
        },
        {
            key: "category_id",
            label: t("documents:properties.category_id"),
            render: (data: Partial<Document>) => <>{data.category_id}</>,
        },
        {
            key: "priority",
            label: t("documents:properties.priority"),
            render: (data: Partial<Document>) => <>{data.priority}</>,
        },
        {
            key: "digitization_list_id",
            label: t("documents:properties.digitization_list_id"),
            render: (data: Partial<Document>) => (
                <>{data.digitization_list_id}</>
            ),
        },
        {
            key: "digitization_list_state",
            label: t("documents:properties.digitization_list_state"),
            render: (data: Partial<Document>) => (
                <>{data.digitization_list_state}</>
            ),
        },
        {
            key: "status",
            label: t("documents:properties.status"),
            alwaysShow: true,
            render: (data: Partial<Document>) => <>{data.status}</>,
        },
        {
            key: "created_by",
            label: t("documents:properties.created_by"),
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
}

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
    { field: "material_type", type: "terms" },
    { field: "status", type: "terms" },
    { field: "category_id", type: "terms" },
];

function getSortOptions(t: TFunction): EsSortOption[] {
    return [
        {
            label: t("common:controls.sort-by.relevance"),
            value: [
                { field: "_score", order: "desc" },
                { field: "created_at", order: "desc" },
            ],
        },
        {
            label: t("common:controls.sort-by.created-desc"),
            value: [{ field: "created_at", order: "desc" }],
        },
        {
            label: t("common:controls.sort-by.created-asc"),
            value: [{ field: "created_at", order: "asc" }],
        },
        {
            label: t("common:controls.sort-by.updated-desc"),
            value: [{ field: "updated_at", order: "desc" }],
        },
        {
            label: t("common:controls.sort-by.updated-asc"),
            value: [{ field: "updated_at", order: "asc" }],
        },
        {
            label: t("common:controls.sort-by.title-asc"),
            value: [
                { field: "title", order: "asc" },
                { field: "volume_number", order: "asc" },
                { field: "volume_year", order: "asc" },
                { field: "bundle", order: "asc" },
            ],
        },
        {
            label: t("common:controls.sort-by.title-desc"),
            value: [
                { field: "title", order: "desc" },
                { field: "volume_number", order: "desc" },
                { field: "volume_year", order: "desc" },
                { field: "bundle", order: "desc" },
            ],
        },
    ];
}

interface Category {
    id: number;
    name: string;
    children: Category[];
}

const getBulkActionsConfig = (
    t: TFunction,
    categories: Category[]
): ActionConfig[] => {
    return [
        {
            label: t("documents:controls.bulk-actions.export.label"),
            actions: [
                {
                    label: t("documents:controls.bulk-actions.export.csv"),
                    onClick: () => {},
                },
                {
                    label: t("documents:controls.bulk-actions.export.xlsx"),
                    onClick: () => {},
                },
            ],
        },
        {
            label: t("documents:controls.bulk-actions.change-category"),
            actions: categories.map((category) => ({
                label: category.name,
                actions: category.children.map((child) => ({
                    label: child.name,
                    onClick: () => {},
                })),
            })),
        },
    ];
};

const DocumentsSection = (): ReactElement => {
    const { t } = useTranslation();

    const columnConfigs = getColumnConfigs(t);
    const sortOptions = getSortOptions(t);

    return (
        <EsTableComplexFilters
            columnConfigs={columnConfigs}
            searchConfig={searchConfig}
            filterConfigs={filterConfigs}
            sortOptions={sortOptions}
            actionsConfig={getBulkActionsConfig(t, [])}
            initState={initEsPageState(
                columnConfigs,
                filterConfigs,
                sortOptions[0]
            )}
            useItemsSource={useSearchDocumentsBatch}
            texts={{
                bulkSelector: {
                    selectNone: t("common:controls.select-none"),
                    selectPage: (values) =>
                        t("common:controls.select-page", values),
                    selectAll: (values) =>
                        t("common:controls.select-all", values),
                    selectedCount: (values) =>
                        t("common:controls.selected-count", values),
                },
                actionsMenuLabel: t("documents:controls.actions-menu-label"),
                searchBarPlaceholder: t(
                    "documents:controls.search-placeholder"
                ),
                filters: {
                    label: t("common:controls.show-filters"),
                    labelExpanded: t("common:controls.hide-filters"),
                },
                filterPresets: {
                    placeholder: t("common:controls.watchlists.placeholder"),
                    favoriteGroup: t(
                        "common:controls.watchlists.favorite-group"
                    ),
                    systemPresetsGroup: t(
                        "common:controls.watchlists.system-group"
                    ),
                    userPresetsGroup: t(
                        "common:controls.watchlists.user-group"
                    ),
                    actionsGroup: t("common:controls.watchlists.actions-group"),
                    saveCurrentAction: t(
                        "common:controls.watchlists.save-current-action"
                    ),
                    saveCurrentPrompt: t(
                        "common:controls.watchlists.save-current-prompt"
                    ),
                },
                paginator: {
                    perPageSuffix: t(
                        "common:controls.paginator.per-page-suffix"
                    ),
                    ofWord: t("common:controls.paginator.of-word"),
                },
            }}
        />
    );
};

export default DocumentsSection;
