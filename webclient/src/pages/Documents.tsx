import React from "react";
import Client from "@searchkit/instantsearch-client";
import "../styles/Documents.css";
import DocumentsHeader from "../features/documents/DocumentsHeader";
import DocumentsTable from "../features/documents/DocumentsTable";
import { DigitizationListsProvider } from "../contexts/DigitizationListsContext";
import { CategoriesProvider } from "../contexts/categories/CategoriesContext";
import { GeneratedExtractionsProvider } from "../contexts/GeneratedExtractionsContext";
import { LocationsProvider } from "../contexts/LocationsContext";
import { IntentionsProvider } from "../contexts/categories/IntentionsContext";
import DocumentsQueryRules from "../features/documents/DocumentsQueryRules";
import documentsIndex from "../adapters/IndexDocuments";
import { InstantSearch } from "react-instantsearch";
import DataTableLayout from "../components/layouts/DataTableLayout";
import WithProviders from "../components/wrappers/WithProviders";
import { TasksProvider } from "../contexts/TasksContext";
import { DocumentsProvider } from "../contexts/DocumentsContext";
import {
    createInitState,
    routeToState,
    stateToRoute,
} from "../data/factories/EsQueriesFactory";
import DocumentsDetails from "../features/documents/DocumentsDetails";
import documents_index_settings from "../config/documents_index";
import { AddDocumentsProvider } from "../contexts/AddDocumentsContext";

const Documents: React.FC = () => {
    const searchClient = Client(documentsIndex);

    return (
        <InstantSearch
            indexName="documents"
            searchClient={searchClient}
            routing={{
                stateMapping: {
                    stateToRoute: (state) => stateToRoute(state),
                    routeToState: (route) =>
                        routeToState(
                            route,
                            createInitState(documents_index_settings)
                        ),
                },
            }}
        >
            <TasksProvider>
                <DocumentsProvider searchClient={searchClient}>
                    <WithProviders
                        providers={[
                            AddDocumentsProvider,
                            CategoriesProvider,
                            LocationsProvider,
                            GeneratedExtractionsProvider,
                            DigitizationListsProvider,
                            IntentionsProvider,
                        ]}
                    >
                        <DataTableLayout
                            header={<DocumentsHeader />}
                            sidebar={<DocumentsQueryRules />}
                            datatable={<DocumentsTable />}
                            paginator={<DocumentsTable.Paginator />}
                            dialog={<DocumentsDetails />}
                        />
                    </WithProviders>
                </DocumentsProvider>
            </TasksProvider>
        </InstantSearch>
    );
};

export default Documents;
