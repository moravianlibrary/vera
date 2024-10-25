import Searchkit from "searchkit";
import catalog_records_index_settings from "../config/catalog_records_index";
import ApiCatalogRecords from "./ApiCatalogRecords";

const catalogRecordsIndex = new Searchkit(
    {
        connection: {
            msearch: (requests) => {
                return Promise.all(
                    requests.map((request) => {
                        return ApiCatalogRecords.search(request.body).then(
                            (response) => {
                                return response.data;
                            }
                        );
                    })
                );
            },
        },
        search_settings: catalog_records_index_settings as any,
    },
    { debug: false }
);

export default catalogRecordsIndex;
