import Searchkit from "searchkit";
import ApiDocuments from "../adapters/ApiDocuments";
import documents_index_settings from "../config/documents_index";

const documentsIndex = new Searchkit({
    connection: {
        msearch: (requests) => {
            return Promise.all(
                requests.map((request) => {
                    return ApiDocuments.queryDocuments(request.body).then(
                        (response) => {
                            return response.data;
                        }
                    );
                })
            );
        },
    },
    search_settings: documents_index_settings as any,
});

export default documentsIndex;
