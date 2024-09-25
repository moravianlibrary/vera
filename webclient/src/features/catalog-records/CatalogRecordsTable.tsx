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
import {
    CatalogRecord,
    MarcFieldDifference,
    MarcRecord,
} from "../../adapters/ApiCatalogRecords";
import LabeledComponent from "../../components/LabeledComponent";
import { formatDatetime } from "../../data/factories/DateFactory";
import { Fieldset } from "primereact/fieldset";
import CatalogRecordsDifference from "./CatalogRecordDifference";

interface CatalogRecordsTableProps {}

interface CatalogRecordsDifferencesProps {
    mainRecord: MarcRecord;
    differences: MarcFieldDifference[];
    otherRecord: MarcRecord;
}

const CatalogRecordsDifferences: React.FC<CatalogRecordsDifferencesProps> = ({
    mainRecord,
    differences,
    otherRecord,
}) => {
    const { t } = useTranslation();

    return (
        <Fieldset
            legend={t("catalog-records.differences")}
            className="flex flex-column gap-2"
        >
            {differences.map((difference) => (
                <CatalogRecordsDifference
                    key={difference.toString()}
                    difference={difference}
                />
            ))}
        </Fieldset>
    );
};

interface CatalogRecordDataProps {
    catalogRecord: CatalogRecord;
}

const catalogRecordFields = [
    { attribute: "sysno", label: "catalog-records.sysno" },
    { attribute: "cnb", label: "catalog-records.cnb" },
    { attribute: "language", label: "catalog-records.language" },
    { attribute: "signature", label: "catalog-records.signature" },
    { attribute: "isxn", label: "catalog-records.isxn" },
    { attribute: "skc_sysno", label: "catalog-records.skc-sysno" },
    {
        attribute: "has_valid_main_record",
        label: "catalog-records.has-valid-main-record",
    },
    { attribute: "cnb_sysno", label: "catalog-records.cnb-sysno" },
    { attribute: "has_valid_cnb", label: "catalog-records.has-valid-cnb" },
    {
        attribute: "last_updated",
        label: "catalog-records.last-updated",
        transform: formatDatetime,
    },
];

const CatalogRecordData: React.FC<CatalogRecordDataProps> = ({
    catalogRecord,
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex">
            <div className="flex flex-column">
                {catalogRecordFields
                    .filter((field) => catalogRecord[field.attribute])
                    .map((field) => {
                        return (
                            <LabeledComponent
                                key={field.attribute}
                                label={t(field.label)}
                            >
                                {field.transform
                                    ? field.transform(
                                          catalogRecord[field.attribute]
                                      )
                                    : catalogRecord[field.attribute]}
                            </LabeledComponent>
                        );
                    })}
            </div>
            {catalogRecord.skc_difference && catalogRecord.skc_record && (
                <CatalogRecordsDifferences
                    mainRecord={catalogRecord.main_record}
                    differences={catalogRecord.skc_difference}
                    otherRecord={catalogRecord.skc_record}
                />
            )}
        </div>
    );
};

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
                <CatalogRecordData catalogRecord={data as CatalogRecord} />
            )}
        >
            <Column expander style={{ width: "5rem" }} />
            <Column
                field="sysno"
                header={t("catalog-records.sysno")}
                body={MzkSysnoColumnBody}
            />
            <Column
                field="skc_sysno"
                header={t("catalog-records.skc_sysno")}
                body={SkcSysnoColumnBody}
            />
            <Column
                field="skc_validity"
                header={t("catalog-records.skc_validity")}
                body={SkcValidityColumnBody}
            />
            <Column field="cnb" header={t("catalog-records.cnb")} />
            <Column field="language" header={t("catalog-records.language")} />
            <Column
                field="cnb_sysno"
                header={t("catalog-records.cnb_sysno")}
                body={CnbSysnoColumnBody}
            />
            <Column
                field="cnb_validity"
                header={t("catalog-records.cnb_validity")}
                body={CnbValidityColumnBody}
            />
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
