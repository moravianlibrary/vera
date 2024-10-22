import React from "react";
import { CatalogRecordsProvider } from "../contexts/CatalogRecordsContext";
import CatalogRecordsTable from "../features/catalog-records/CatalogRecordsTable";
import DataTableLayout from "../components/layouts/DataTableLayout";
import Client from "@searchkit/instantsearch-client";
import catalogRecordsIndex from "../adapters/IndexCatalogRecords";
import { InstantSearch } from "react-instantsearch";
import CatalogRecordsQueryRules from "../features/catalog-records/CatalogRecordsQueryRules";
import CatalogRecordsHeader from "../features/catalog-records/CatalogRecordsHeader";
import WithProviders from "../components/wrappers/WithProviders";
import { TasksProvider } from "../contexts/TasksContext";
import { routeToState, stateToRoute } from "../data/factories/EsQueriesFactory";

interface CatalogRecordsProps {}

const CatalogRecords: React.FC<CatalogRecordsProps> = (props) => {
    return <CatalogRecordsDiv {...props} />;
};

const CatalogRecordsDiv: React.FC<CatalogRecordsProps> = () => {
    const searchClient = Client(catalogRecordsIndex);
    return (
        <InstantSearch
            indexName="catalog_records"
            searchClient={searchClient}
            routing={{
                stateMapping: {
                    stateToRoute: (state) =>
                        stateToRoute("catalog_records", state),
                    routeToState: (route) =>
                        routeToState("catalog_records", route),
                },
            }}
            initialUiState={{
                catalog_records: {
                    refinementList: {
                        has_documents: ["1"],
                    },
                },
            }}
        >
            <WithProviders providers={[CatalogRecordsProvider, TasksProvider]}>
                <DataTableLayout
                    header={<CatalogRecordsHeader />}
                    sidebar={<CatalogRecordsQueryRules />}
                    datatable={<CatalogRecordsTable />}
                    paginator={<CatalogRecordsTable.Paginator />}
                />
            </WithProviders>
        </InstantSearch>
    );
};

export default CatalogRecords;
