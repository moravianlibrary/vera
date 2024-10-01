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
        "skc_record",
        "skc_difference",
        "has_valid_main_record",
        "cnb_sysno",
        "cnb_record",
        "cnb_difference",
        "has_valid_cnb",
        "added_at",
        "updated_at",
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
    facet_attributes: [
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
            attribute: "language",
            field: "language",
            type: "string",
        },
        {
            attribute: "material_type",
            field: "material_type",
            type: "string",
        },
    ],
};

export default catalog_records_index_settings;
