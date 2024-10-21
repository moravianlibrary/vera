import documents_index_settings from "./documents_index";
import catalog_records_index_settings from "./catalog_records_index";

const IndexSettingsDispatcher = {
    documents: documents_index_settings,
    catalog_records: catalog_records_index_settings,
};

export { IndexSettingsDispatcher };
