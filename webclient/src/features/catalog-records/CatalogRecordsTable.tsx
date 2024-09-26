import React, { useState } from "react";
import { DataTable, DataTableRowEvent } from "primereact/datatable";
import { useCatalogRecords } from "../../contexts/CatalogRecordsContext";
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
import { ColumnGroup } from "primereact/columngroup";

interface CatalogRecordsTableProps {}

const CatalogRecordsTable: React.FC<CatalogRecordsTableProps> & {
    Paginator: React.FC;
} = () => {
    const { catalogRecords } = useCatalogRecords();
    const { t } = useTranslation();

    const [expandedRows, setExpandedRows] = useState<any[]>([]);

    const handleRowExpand = (e: DataTableRowEvent) => {
        setExpandedRows([...expandedRows, e.data]);
    };

    const handleRowCollapse = (e: DataTableRowEvent) => {
        setExpandedRows(expandedRows.filter((row) => row.id !== e.data.id));
    };

    return (
        <DataTable
            className="overflow-scroll"
            value={catalogRecords}
            scrollable
            scrollHeight="flex"
            expandedRows={expandedRows}
            onRowExpand={handleRowExpand}
            onRowCollapse={handleRowCollapse}
            rowExpansionTemplate={(data) => (
                <CatalogRecordDetails catalogRecord={data as CatalogRecord} />
            )}
        >
            <Column expander style={{ width: "5rem" }} />
            <Column
                field="sysno"
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
        </DataTable>
    );
};

const CatalogRecordsTablePaginator: React.FC = () => {
    const { numFound, page, setPage, pageSize, setPageSize, refresh } =
        useCatalogRecords();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            onPageChangeNew={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            onRefresh={refresh}
            numFoundText="catalog-records.numFound"
        />
    );
};

CatalogRecordsTable.Paginator = CatalogRecordsTablePaginator;

export default CatalogRecordsTable;
