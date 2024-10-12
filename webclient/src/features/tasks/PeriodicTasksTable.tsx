import { DataTable } from "primereact/datatable";
import React from "react";
import { usePeriodicTasks } from "../../contexts/PeriodicTasksContext";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import DataTablePaginator from "../../components/DataTablePaginator";

interface PeriodicTasksTableProps {}

const PeriodicTasksTable: React.FC<PeriodicTasksTableProps> & {
    Paginator: React.FC;
} = ({}) => {
    const { t } = useTranslation();
    const { items } = usePeriodicTasks();

    return (
        <DataTable
            className="items-table"
            value={items}
            scrollable
            scrollHeight="flex"
        >
            <Column expander style={{ width: "5rem" }} />
            <Column field="id" header={t("id")} />
            <Column field="owner" header={t("owner")} />
            <Column field="error_count" header={t("Error count")} />
        </DataTable>
    );
};

const PeriodicTasksTablePaginator: React.FC = () => {
    const { numFound, page, setPage, pageSize, setPageSize } =
        usePeriodicTasks();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChangeNew={setPage}
            onPageSizeChange={setPageSize}
            numFoundText="tasks.num-found"
        />
    );
};

PeriodicTasksTable.Paginator = PeriodicTasksTablePaginator;

export default PeriodicTasksTable;
