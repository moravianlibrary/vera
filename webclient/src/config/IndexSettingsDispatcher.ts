import { EsIndexSettings } from "../elasticsearch/IndexSettings";

const documentsIndexSettings: EsIndexSettings = {
    index_name: "documents",
    search_attributes: [
        { field: "title", weight: 3 },
        "sysno",
        "barcode",
        "cnb",
        "signature",
        "isxn",
        "publisher",
    ],
    result_attributes: [
        "id",
        // Main identifiers
        "sysno",
        "barcode",
        "volume",
        "volume_number",
        "volume_year",
        "volume_year_number",
        "bundle",
        "bundle_number",
        // Librarian identifiers
        "cnb",
        "language",
        "signature",
        "isxn",
        // VERA properties
        "added_at",
        "added_by",
        "indexed_at",
        "category_id",
        "category_ids",
        "category_path",
        "document_flags",
        // Catalog properties
        "skc_sysno",
        "skc_diff",
        "cnb_sysno",
        "cnb_diff",
        "digitization_registry_id",
        "digitization_state",
        // Page count
        "page_count",
        "page_count_catalog",
        "page_count_manual",
        "page_count_predicted",
        // Extraction properties
        "dedicated_scanner",
        "extraction_priority",
        "extraction_ids",
        "digitization_list_id",
        // Other properties
        "material_type",
        "issuance_type",
        "title",
        "size",
        "location_uri",
        // Publication properties
        "publisher",
        "publishing_place",
        "publishing_year",
        "languages",
        "frequencies",
    ],
    sorting: {
        newest: { field: "added_at", order: "desc" },
        oldest: { field: "added_at", order: "asc" },
        last_edited: [{ field: "indexed_at", order: "desc" }],
        priority: [
            { field: "extraction_priority", order: "desc" },
            { field: "indexed_at", order: "desc" },
        ],
        title_asc: { field: "title", order: "asc" },
        title_desc: { field: "title", order: "desc" },
    },
    facet_attributes: [
        {
            field: "document_flags",
            type: "string",
        },
        {
            field: "digitization_state",
            type: "string",
        },
        {
            field: "material_type",
            type: "string",
        },
        {
            field: "issuance_type",
            type: "string",
        },
        {
            field: "added_by",
            type: "string",
        },
        {
            field: "category_path.category_id",
            type: "nested",
            limit: 100,
        },
        {
            field: "extraction_ids",
            type: "numeric",
            order: {
                _key: "desc",
            },
        },
        {
            field: "digitization_list_id",
            type: "numeric",
            order: {
                _key: "desc",
            },
        },
    ],
    filter_attributes: {
        id: "value",
        page_count: "range",
        volume_number: "range",
        volume_year_number: "range",
        bundle_number: "range",
        page_count_manual: "range",
        page_count_catalog: "range",
        page_count_predicted: "range",
    },
};

const IndexSettingsDispatcher = {
    documents: documentsIndexSettings,
};

export { IndexSettingsDispatcher };
