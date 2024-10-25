import React from "react";
import { CatalogRecordsProvider } from "../contexts/CatalogRecordsContext";
import CatalogRecordsTable from "../features/catalog-records/CatalogRecordsTable";
import DataTableLayout from "../components/layouts/DataTableLayout";
import Client from "@searchkit/instantsearch-client";
import catalogRecordsIndex from "../adapters/IndexCatalogRecords";
import { InstantSearch } from "react-instantsearch";
import CatalogRecordsQueryRules from "../features/catalog-records/CatalogRecordsQueryRules";
import CatalogRecordsHeader from "../features/catalog-records/CatalogRecordsHeader";
import { TasksProvider } from "../contexts/TasksContext";
import {
    createInitState,
    routeToState,
    stateToRoute,
} from "../data/factories/EsQueriesFactory";
import catalog_records_index_settings from "../config/catalog_records_index";

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
                    stateToRoute: (state) => stateToRoute(state),
                    routeToState: (route) =>
                        routeToState(
                            route,
                            createInitState(catalog_records_index_settings)
                        ),
                },
            }}
        >
            <TasksProvider>
                <CatalogRecordsProvider searchClient={searchClient}>
                    <DataTableLayout
                        header={<CatalogRecordsHeader />}
                        sidebar={<CatalogRecordsQueryRules />}
                        datatable={<CatalogRecordsTable />}
                        paginator={<CatalogRecordsTable.Paginator />}
                    />
                </CatalogRecordsProvider>
            </TasksProvider>
        </InstantSearch>
    );
};

export default CatalogRecords;
