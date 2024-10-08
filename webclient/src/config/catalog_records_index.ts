import { filterBooleanQuery } from "../data/factories/EsQueriesFactory";

const catalog_records_index_settings = {
    search_attributes: [
        { field: "id", weight: 3 },
        "skc_sysno",
        "cnb_sysno",
        "cnb",
        "signature",
        "isxn",
        "barcodes",
        "publisher",
    ],
    result_attributes: [
        "id",
        "main_record",
        "cnb",
        "language",
        "signature",
        "isxn",
        "barcodes",
        "skc_sysno",
        "skc_sysno_resolved",
        "skc_record",
        "skc_difference",
        "has_valid_main_record",
        "cnb_sysno",
        "cnb_sysno_resolved",
        "cnb_record",
        "cnb_difference",
        "has_valid_cnb",
        "added_at",
        "updated_at",
        "indexed_at",
        "material_type",
        "title",
        "size",
        "location_uri",
        "publisher",
        "publishing_place",
        "publishing_year",
        "languages",
        "frequencies",
    ],
    highlight_attributes: ["id"],
    sorting: {
        default: [{ field: "indexed_at", order: "desc" }],
        _last_edited: [{ field: "indexed_at", order: "desc" }],
        _non_valid_first: [
            { field: "has_valid_main_record", order: "asc" },
            { field: "has_valid_cnb", order: "asc" },
            { field: "indexed_at", order: "desc" },
        ],
        _valid_first: [
            { field: "has_valid_main_record", order: "desc" },
            { field: "has_valid_cnb", order: "desc" },
            { field: "indexed_at", order: "desc" },
        ],
        _newest: { field: "added_at", order: "desc" },
        _oldest: { field: "added_at", order: "asc" },
    },
    facet_attributes: [
        {
            attribute: "has_valid_main_record",
            field: "has_valid_main_record",
            type: "numeric",
            filterQuery: filterBooleanQuery,
        },
        {
            attribute: "skc_sysno_resolved",
            field: "skc_sysno_resolved",
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
            attribute: "cnb_sysno_resolved",
            field: "cnb_sysno_resolved",
            type: "numeric",
            filterQuery: filterBooleanQuery,
        },
        {
            attribute: "material_type",
            field: "material_type",
            type: "string",
        },
        {
            attribute: "skc_difference_type_facets",
            field: "skc_difference_type_facets",
            type: "string",
        },
        {
            attribute: "skc_difference_tag_facets",
            field: "skc_difference_tag_facets",
            type: "string",
        },
        {
            attribute: "cnb_difference_type_facets",
            field: "cnb_difference_type_facets",
            type: "string",
        },
        {
            attribute: "cnb_difference_tag_facets",
            field: "cnb_difference_tag_facets",
            type: "string",
        },
        {
            attribute: "language",
            field: "language",
            type: "string",
        },
    ],
};

const booleanAttributes = [
    "has_valid_main_record",
    "has_valid_cnb",
    "skc_sysno_resolved",
    "cnb_sysno_resolved",
];

export default catalog_records_index_settings;
export { booleanAttributes };
