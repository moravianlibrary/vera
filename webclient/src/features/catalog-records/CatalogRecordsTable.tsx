import React from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import DataTablePaginator from "../../components/views/DataTablePaginator";
import SkcValidityColumnBody from "./table-columns/SkcValidityColumnBody";
import SkcSysnoColumnBody from "./table-columns/SkcSysnoColumnBody";
import CnbSysnoColumnBody from "./table-columns/CnbSysnoColumnBody";
import CnbValidityColumnBody from "./table-columns/CnbValidityColumnBody";
import MzkSysnoColumnBody from "./table-columns/MzkSysnoColumnBody";
import { CatalogRecord } from "../../adapters/ApiCatalogRecords";
import CatalogRecordDetails from "./CatalogRecordDetails";
import { useCatalogRecords } from "../../contexts/CatalogRecordsContext";

interface CatalogRecordsTableProps {}

const CatalogRecordsTable: React.FC<CatalogRecordsTableProps> & {
    Paginator: React.FC;
} = () => {
    const { t } = useTranslation("catalog-records");
    const {
        items,
        currentPageSelected,
        handleDataTableSelectionChange,
        expandedRows,
        onRowExpandEvent,
        onRowCollapseEvent,
    } = useCatalogRecords();

    return (
        <DataTable
            value={items}
            scrollable
            scrollHeight="flex"
            expandedRows={expandedRows}
            onRowExpand={onRowExpandEvent}
            onRowCollapse={onRowCollapseEvent}
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
                header={t("table.columns.mzk-sysno")}
                body={MzkSysnoColumnBody}
            />
            <Column
                field="skc_sysno"
                header={t("table.columns.skc-sysno")}
                body={SkcSysnoColumnBody}
            />
            <Column
                field="cnb_sysno"
                header={t("table.columns.cnb-sysno")}
                body={CnbSysnoColumnBody}
            />
            <Column
                field="skc_validity"
                header={t("table.columns.skc-validity")}
                body={SkcValidityColumnBody}
            />
            <Column
                field="cnb_validity"
                header={t("table.columns.cnb-validity")}
                body={CnbValidityColumnBody}
            />
            <Column field="cnb" header={t("table.columns.cnb")} />
            <Column field="language" header={t("table.columns.language")} />
            <Column selectionMode="multiple" />
        </DataTable>
    );
};

const CatalogRecordsTablePaginator: React.FC = () => {
    const { t } = useTranslation("catalog-records");
    const { numFound, refresh, page, setPage, pageSize, setPageSize } =
        useCatalogRecords();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChangeNew={setPage}
            onPageSizeChange={setPageSize}
            onRefresh={refresh}
            numFoundText={t("num-found", { count: numFound })}
        />
    );
};

CatalogRecordsTable.Paginator = CatalogRecordsTablePaginator;

export default CatalogRecordsTable;
