import React from "react";
import { CatalogRecordsProvider } from "../contexts/CatalogRecordsContext";
import CatalogRecordsTable from "../features/catalog-records/CatalogRecordsTable";
import DataTableLayout from "../components/layouts/DataTableLayout";

interface CatalogRecordsProps {}

const CatalogRecords: React.FC<CatalogRecordsProps> = () => {
    return (
        <CatalogRecordsProvider>
            <DataTableLayout
                // header={<h1>Catalog Records</h1>}
                datatable={<CatalogRecordsTable />}
                paginator={<CatalogRecordsTable.Paginator />}
            />
        </CatalogRecordsProvider>
    );
};

export default CatalogRecords;
