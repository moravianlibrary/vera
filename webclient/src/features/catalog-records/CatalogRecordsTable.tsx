import React, { useEffect, useState } from "react";
import { DataTable, DataTableRowEvent } from "primereact/datatable";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import DataTablePaginator from "../../components/DataTablePaginator";
import SkcValidityColumnBody from "./table-columns/SkcValidityColumnBody";
import SkcSysnoColumnBody from "./table-columns/SkcSysnoColumnBody";
import CnbSysnoColumnBody from "./table-columns/CnbSysnoColumnBody";
import CnbValidityColumnBody from "./table-columns/CnbValidityColumnBody";
import MzkSysnoColumnBody from "./table-columns/MzkSysnoColumnBody";
import { CatalogRecord } from "../../adapters/ApiCatalogRecords";
import CatalogRecordDetails from "./CatalogRecordDetails";
import { useEsDataTable } from "../../contexts/EsDataTableContext";

interface CatalogRecordsTableProps {}

const CatalogRecordsTable: React.FC<CatalogRecordsTableProps> & {
    Paginator: React.FC;
} = () => {
    const { t } = useTranslation();
    const { items, currentPageSelected, handleDataTableSelectionChange } =
        useEsDataTable();

    const [expandedRows, setExpandedRows] = useState<any[]>([]);

    const handleRowExpand = (e: DataTableRowEvent) => {
        setExpandedRows([...expandedRows, e.data]);
    };

    const handleRowCollapse = (e: DataTableRowEvent) => {
        setExpandedRows(expandedRows.filter((row) => row.id !== e.data.id));
    };

    return (
        <DataTable
            value={items}
            scrollable
            scrollHeight="flex"
            dataKey={"id"}
            expandedRows={expandedRows}
            onRowExpand={handleRowExpand}
            onRowCollapse={handleRowCollapse}
            rowExpansionTemplate={(data) => (
                <CatalogRecordDetails catalogRecord={data as CatalogRecord} />
            )}
            selectionMode="checkbox"
            selection={currentPageSelected}
            onSelectionChange={handleDataTableSelectionChange}
        >
            <Column expander style={{ width: "5rem" }} />
            <Column
                field="id"
                header={t("catalog-records.mzk-sysno")}
                body={MzkSysnoColumnBody}
            />
            <Column
                field="skc_sysno"
                header={t("catalog-records.skc-sysno")}
                body={SkcSysnoColumnBody}
            />
            <Column
                field="cnb_sysno"
                header={t("catalog-records.cnb-sysno")}
                body={CnbSysnoColumnBody}
            />
            <Column
                field="skc_validity"
                header={t("catalog-records.skc-validity")}
                body={SkcValidityColumnBody}
            />
            <Column
                field="cnb_validity"
                header={t("catalog-records.cnb-validity")}
                body={CnbValidityColumnBody}
            />
            <Column field="cnb" header={t("catalog-records.cnb")} />
            <Column field="language" header={t("catalog-records.language")} />
            <Column selectionMode="multiple" />
        </DataTable>
    );
};

const CatalogRecordsTablePaginator: React.FC = () => {
    const { numFound, refresh, page, setPage, pageSize, setPageSize } =
        useEsDataTable();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChangeNew={setPage}
            onPageSizeChange={setPageSize}
            onRefresh={refresh}
            numFoundText="catalog-records.numFound"
        />
    );
};

CatalogRecordsTable.Paginator = CatalogRecordsTablePaginator;

export default CatalogRecordsTable;
