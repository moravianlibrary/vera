import React from "react";
import Client from "@searchkit/instantsearch-client";
import "../styles/Documents.css";
import DocumentsHeader from "../features/documents/DocumentsHeader";
import DocumentsTable from "../features/documents/DocumentsTable";
import { DigitizationListsProvider } from "../contexts/extractions/DigitizationListsContext";
import { DigitizationListsManagerProvider } from "../contexts/extractions/DigitizationListsManagerContext";
import { CategoriesProvider } from "../contexts/categories/CategoriesContext";
import { GeneratedExtractionsProvider } from "../contexts/extractions/GeneratedExtractionsContext";
import { LocationsProvider } from "../contexts/extractions/locations/LocationsContext";
import { IntentionsProvider } from "../contexts/categories/IntentionsContext";
import DocumentsQueryRules from "../features/documents/DocumentsQueryRules";
import documentsIndex from "../adapters/IndexDocuments";
import { InstantSearch } from "react-instantsearch";
import DocumentDetailsDialog from "../features/documents/DocumentDetailsDialog";
import DataTableLayout from "../components/layouts/DataTableLayout";
import WithProviders from "../components/wrappers/WithProviders";
import { EsDataTableProvider } from "../contexts/EsDataTableContext";
import { TasksProvider } from "../contexts/tasks/TasksContext";
import { DocumentsProvider } from "../contexts/DocumentsContext";
import { routeToState, stateToRoute } from "../data/factories/EsQueriesFactory";
import { booleanAttributes } from "../config/documents_index";

const Documents: React.FC = () => {
    const searchClient = Client(documentsIndex);

    return (
        <InstantSearch
            indexName="documents"
            searchClient={searchClient}
            routing={{
                stateMapping: {
                    stateToRoute: (state) =>
                        stateToRoute("documents", booleanAttributes, state),
                    routeToState: (route) =>
                        routeToState("documents", booleanAttributes, route),
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
                    EsDataTableProvider,
                    TasksProvider,
                ]}
            >
                <DataTableLayout
                    header={<DocumentsHeader />}
                    sidebar={<DocumentsQueryRules />}
                    datatable={<DocumentsTable />}
                    paginator={<DocumentsTable.Paginator />}
                />
                {/* {detailsDocuments.map((document) => (
                    <DocumentDetailsDialog
                        key={document.id}
                        document={document}
                    />
                ))} */}
            </WithProviders>
        </InstantSearch>
    );
};

export default Documents;
