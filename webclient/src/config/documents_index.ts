import {
    filterBooleanQuery,
    sortFacetDescByKey,
} from "../data/factories/EsQueriesFactory";

const documents_index_settings = {
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
        "category_id",
        "category_path",
        // Catalog properties
        "skc_sysno",
        "skc_diff",
        "has_valid_main_record",
        "cnb_sysno",
        "cnb_diff",
        "has_valid_cnb",
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
        "is_extractable",
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
    highlight_attributes: ["title"],
    sorting: {
        default: [{ field: "indexed_at", order: "desc" }],
        _last_edited: [{ field: "indexed_at", order: "desc" }],
        _newest: { field: "added_at", order: "desc" },
        _oldest: { field: "added_at", order: "asc" },
        _title_asc: { field: "title", order: "asc" },
        _title_desc: { field: "title", order: "desc" },
    },
    facet_attributes: [
        {
            attribute: "is_extractable",
            field: "is_extractable",
            type: "numeric",
            filterQuery: filterBooleanQuery,
        },
        {
            attribute: "has_valid_main_record",
            field: "has_valid_main_record",
            type: "numeric",
            filterQuery: filterBooleanQuery,
        },
        {
            attribute: "has_valid_cnb",
            field: "has_valid_cnb",
            type: "numeric",
            filterQuery: filterBooleanQuery,
        },
        {
            attribute: "digitization_state",
            field: "digitization_state",
            type: "string",
        },
        {
            attribute: "material_type",
            field: "material_type",
            type: "string",
        },
        {
            attribute: "issuance_type",
            field: "issuance_type",
            type: "string",
        },
        {
            attribute: "added_by",
            field: "added_by",
            type: "string",
        },
        {
            attribute: "category_id",
            field: "category_id",
            type: "numeric",
        },
        {
            attribute: "digitization_list_id",
            field: "digitization_list_id",
            type: "numeric",
            facetQuery: sortFacetDescByKey,
        },
        {
            attribute: "page_count",
            field: "page_count",
            type: "numeric",
        },
        {
            attribute: "volume_number",
            field: "volume_number",
            type: "numeric",
        },
        {
            attribute: "volume_year_number",
            field: "volume_year_number",
            type: "numeric",
        },
        {
            attribute: "bundle_number",
            field: "bundle_number",
            type: "numeric",
        },
        {
            attribute: "page_count_manual",
            field: "page_count_manual",
            type: "numeric",
        },
        {
            attribute: "page_count_catalog",
            field: "page_count_catalog",
            type: "numeric",
        },
        {
            attribute: "page_count_predicted",
            field: "page_count_predicted",
            type: "numeric",
        },
    ],
};

const booleanAttributes = [
    "is_extractable",
    "has_valid_main_record",
    "has_valid_cnb",
];

export default documents_index_settings;
export { booleanAttributes };
