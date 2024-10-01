import React from "react";
import { CatalogRecordsProvider } from "../contexts/CatalogRecordsContext";
import CatalogRecordsTable from "../features/catalog-records/CatalogRecordsTable";
import DataTableLayout from "../components/layouts/DataTableLayout";
import Client from "@searchkit/instantsearch-client";
import catalogRecordsIndex from "../adapters/IndexCatalogRecords";
import { InstantSearch } from "react-instantsearch";
import CatalogRecordsFacetsBar from "../features/catalog-records/CatalogRecordsFacetsBar";

interface CatalogRecordsProps {}

const CatalogRecords: React.FC<CatalogRecordsProps> = (props) => {
    return (
        <CatalogRecordsProvider>
            <CatalogRecordsDiv {...props} />
        </CatalogRecordsProvider>
    );
};

const CatalogRecordsDiv: React.FC<CatalogRecordsProps> = () => {
    const searchClient = Client(catalogRecordsIndex);
    return (
        <InstantSearch indexName="catalog_records" searchClient={searchClient}>
            <DataTableLayout
                sidebar={<CatalogRecordsFacetsBar />}
                datatable={<CatalogRecordsTable />}
                paginator={<CatalogRecordsTable.Paginator />}
            />
        </InstantSearch>
    );
};

export default CatalogRecords;
