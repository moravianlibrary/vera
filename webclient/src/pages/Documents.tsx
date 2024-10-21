import React from "react";
import Client from "@searchkit/instantsearch-client";
import "../styles/Documents.css";
import DocumentsHeader from "../features/documents/DocumentsHeader";
import DocumentsTable from "../features/documents/DocumentsTable";
import { DigitizationListsProvider } from "../contexts/DigitizationListsContext";
import { DigitizationListsManagerProvider } from "../contexts/extractions/DigitizationListsManagerContext";
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
import { routeToState, stateToRoute } from "../data/factories/EsQueriesFactory";
import DocumentsDetails from "../features/documents/DocumentsDetails";

const Documents: React.FC = () => {
    const searchClient = Client(documentsIndex);

    return (
        <InstantSearch
            indexName="documents"
            searchClient={searchClient}
            routing={{
                stateMapping: {
                    stateToRoute: (state) => stateToRoute("documents", state),
                    routeToState: (route) => routeToState("documents", route),
                },
            }}
        >
            <WithProviders
                providers={[
                    CategoriesProvider,
                    LocationsProvider,
                    GeneratedExtractionsProvider,
                    DigitizationListsManagerProvider,
                    DigitizationListsProvider,
                    IntentionsProvider,
                    DocumentsProvider,
                    TasksProvider,
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
        </InstantSearch>
    );
};

export default Documents;
