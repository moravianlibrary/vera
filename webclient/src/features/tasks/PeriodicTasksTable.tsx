import { DataTable } from "primereact/datatable";
import React from "react";
import { usePeriodicTasks } from "../../contexts/PeriodicTasksContext";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import DataTablePaginator from "../../components/DataTablePaginator";
import EsQueryChips from "../../components/elasticsearch/EsQueryChips";
import DeleteButton from "../../components/buttons/DeleteButton";

interface PeriodicTasksTableProps {}

const PeriodicTasksTable: React.FC<PeriodicTasksTableProps> & {
    Paginator: React.FC;
} = ({}) => {
    const { t } = useTranslation("periodic-tasks");
    const { items, deleteItem } = usePeriodicTasks();

    return (
        <DataTable
            className="items-table"
            value={items}
            scrollable
            scrollHeight="flex"
        >
            <Column field="id" header={t("table.columns.id")} />
            <Column
                field="task_type"
                header={t("table.columns.task-type")}
                body={(task) =>
                    t(`task-type.${task.task_type}`, { ns: "types" })
                }
            />
            <Column
                field="query_params"
                header={t("table.columns.query-params")}
                body={(pt) => <EsQueryChips queryParams={pt.query_params} />}
            />
            <Column field="hour" header={t("table.columns.hour")} />
            <Column field="minute" header={t("table.columns.minute")} />
            <Column
                field="day_of_week"
                header={t("table.columns.day-of-week")}
            />
            <Column
                field="day_of_month"
                header={t("table.columns.day-of-month")}
            />
            <Column
                body={(pt) => (
                    <DeleteButton itemId={pt.id} onDeleteItem={deleteItem} />
                )}
            />
        </DataTable>
    );
};

const PeriodicTasksTablePaginator: React.FC = () => {
    const { t } = useTranslation("periodic-tasks");
    const { numFound, page, setPage, pageSize, setPageSize } =
        usePeriodicTasks();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChangeNew={setPage}
            onPageSizeChange={setPageSize}
            numFoundText={t("num-found", { count: numFound })}
        />
    );
};

PeriodicTasksTable.Paginator = PeriodicTasksTablePaginator;

export default PeriodicTasksTable;
