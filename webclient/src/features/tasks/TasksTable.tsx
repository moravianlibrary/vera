import { DataTable, DataTableRowEditEvent } from "primereact/datatable";
import React, { useEffect, useState } from "react";
import { useTasks } from "../../contexts/TasksContext";
import { Task, TaskItem } from "../../adapters/ApiTasks";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { TaskState } from "../../types/TaskState";
import { format } from "date-fns";
import { MultiSelect } from "primereact/multiselect";
import { Button } from "primereact/button";
import config from "../../config/config";
import DataTablePaginator from "../../components/views/DataTablePaginator";
import { TaskStateTag } from "../../components/tags/TaskStateTag";
import { ManagementTasks, NoItemsTasks } from "../../types/TaskType";

interface TasksTableProps {}

interface TaskItemsProps {
    task: Task;
}

const TasksTable: React.FC<TasksTableProps> & {
    Paginator: React.FC;
} = () => {
    const { t } = useTranslation("tasks");
    const { tasks } = useTasks();

    const [expandedRows, setExpandedRows] = useState<Task[]>([]);

    const handleRowExpand = (e: DataTableRowEditEvent) => {
        setExpandedRows([...expandedRows, e.data as Task]);
    };

    const handleRowCollapse = (e: DataTableRowEditEvent) => {
        setExpandedRows(expandedRows.filter((row) => row.id !== e.data.id));
    };

    const itemsCountBody = (task: Task) => {
        return NoItemsTasks.includes(task.task_type)
            ? "-"
            : task.task_state === TaskState.Finished
            ? `${task.total_count}`
            : `${task.processed_count}/${task.total_count}`;
    };

    const errorsCountBody = (task: Task) => {
        return NoItemsTasks.includes(task.task_type) ? "-" : task.error_count;
    };

    const datetimeBody = (datetime: string) => {
        return datetime
            ? format(new Date(datetime), "dd.MM.yyyy HH:mm:ss")
            : null;
    };

    const durationBody = (task: Task) => {
        if (!task.started || !task.finished) {
            return;
        }
        const startDate = new Date(task.started!).getTime();
        const endDate = new Date(task.finished!).getTime();
        const dateDifference = endDate - startDate;

        const hours = Math.floor(
            (dateDifference % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
        );
        const minutes = Math.floor(
            (dateDifference % (60 * 60 * 1000)) / (60 * 1000)
        );
        const seconds = Math.floor((dateDifference % (60 * 1000)) / 1000);

        if (minutes === 0) {
            return `${seconds} s`;
        }
        const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;
        if (hours === 0) {
            return `${minutes}:${paddedSeconds}`;
        }
        const paddedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    };

    const getAdditionalData = (task: Task) => {
        if (task.total_count > 0) {
            return <TaskItems task={task} />;
        } else if (task.has_dataset) {
            return <TaskCsv task={task} />;
        }
    };

    return (
        <DataTable
            className="items-table"
            value={tasks}
            scrollable
            scrollHeight="flex"
            expandedRows={expandedRows}
            onRowExpand={handleRowExpand}
            onRowCollapse={handleRowCollapse}
            rowExpansionTemplate={getAdditionalData}
        >
            <Column expander style={{ width: "5rem" }} />
            <Column field="id" header={t("table.columns.id")} />
            <Column
                body={(task) =>
                    t(`task-type.${task.task_type}`, { ns: "types" })
                }
                header={t("table.columns.task-type")}
            />
            <Column field="owner" header={t("table.columns.owner")} />
            <Column
                body={(task) => (
                    <TaskStateTag
                        state={task.task_state}
                        errorCount={task.error_count}
                    />
                )}
                header={t("table.columns.task-state")}
            />
            <Column
                header={t("table.columns.items-count")}
                body={itemsCountBody}
            />
            <Column
                field="error_count"
                header={t("table.columns.error-count")}
                body={errorsCountBody}
            />
            <Column
                body={(task) => datetimeBody(task.planned)}
                header={t("table.columns.planned")}
            />
            <Column
                body={(task) => datetimeBody(task.started)}
                header={t("table.columns.started")}
            />
            <Column
                body={(task) => datetimeBody(task.finished)}
                header={t("table.columns.finished")}
            />
            <Column body={durationBody} header={t("table.columns.duration")} />
        </DataTable>
    );
};

const TasksTablePaginator: React.FC = () => {
    const { t } = useTranslation("tasks");
    const { numFound, page, setPage, pageSize, setPageSize } = useTasks();

    return (
        <DataTablePaginator
            numFound={numFound}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            numFoundText={t("num-found", { count: numFound })}
        />
    );
};

TasksTable.Paginator = TasksTablePaginator;

const TaskItems: React.FC<TaskItemsProps> = ({ task }) => {
    const { t } = useTranslation("tasks");
    const { getTaskItems } = useTasks();

    // const [items, setItems] = useState<TaskItem[]>([]);
    const [itemsCount, setItemsCount] = useState<number>(0);
    const [showItems, setShowItems] = useState<TaskItem[]>([]);
    const [errorTypes, setErrorTypes] = useState<string[]>([]);
    const [errorTypesFilter, setErrorTypesFilter] = useState<string[]>([]);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);

    useEffect(() => {
        getTaskItems(task.id, page, 20)
            .then((taskItemsPage) => {
                // setItems(taskItemsPage.items);
                setItemsCount(taskItemsPage.num_found);
                setShowItems(taskItemsPage.items);
                // setErrorTypes([
                //     ...new Set(
                //         taskItemsPage.items
                //             .map((d) =>
                //                 d.error_type ? d.error_type : "without-error"
                //             )
                //             .filter((t) => t)
                //     ),
                // ]);
            })
            .catch((error) => {
                console.error(`Could not receive task items: ${error}`);
            });
    }, [page, getTaskItems, task.id]);

    // useEffect(() => {
    //     if (errorTypesFilter.length === 0) {
    //         setShowItems(items);
    //         return;
    //     }
    //     setShowItems(
    //         items.filter((item) => {
    //             return (
    //                 (errorTypesFilter.includes("Without error") &&
    //                     !item.error_type) ||
    //                 errorTypesFilter.includes(item.error_type)
    //             );
    //         })
    //     );
    // }, [errorTypesFilter, items]);

    const errorTypeHeader = () => {
        return (
            <div className="flex justify-content-start align-items-center gap-4">
                <span>{t("table.columns.item-error-type")}</span>
                {errorTypes.length > 1 &&
                    errorTypes.includes("table.values.item-without-error") && (
                        <MultiSelect
                            className="m-0 h-full"
                            value={errorTypesFilter}
                            options={errorTypes.map((type) => ({
                                label: t(type),
                                value: type,
                            }))}
                            onChange={(e) => setErrorTypesFilter(e.value)}
                            placeholder={t("Any")}
                            emptyFilterMessage=""
                        />
                    )}
            </div>
        );
    };

    const processedBody = (item: TaskItem) => {
        if (item.processed) {
            return <i className="pi pi-check text-green-700"></i>;
        } else {
            return <i className="pi pi-times text-red-700"></i>;
        }
    };

    return (
        <div className="flex flex-column">
            {itemsCount > 20 && (
                <DataTablePaginator
                    numFound={task.total_count}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                />
            )}
            <DataTable value={showItems}>
                <Column field="item_id" header={t("table.columns.item-id")} />
                <Column
                    field="processed"
                    header={t("table.columns.item-processed")}
                    body={processedBody}
                />
                <Column
                    field="error_type"
                    header={errorTypeHeader}
                    body={(item) => t(item.error_type)}
                />
                <Column
                    field="error_message"
                    header={t("table.columns.item-error-message")}
                    body={(item) => t(item.error_message)}
                />
            </DataTable>
        </div>
    );
};

const TaskCsv: React.FC<TaskItemsProps> = ({ task }) => {
    const { t } = useTranslation("tasks");
    const fileUrl = `${config.apiUrl}tasks/${task.id}/csv`;

    const handleDownload = () => {
        if (fileUrl) {
            const link = document.createElement("a");
            link.href = fileUrl;
            link.setAttribute(
                "download",
                `${t("task")}_${task.id}_${task.task_type}.csv`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <Button
            label={t("actions.download-csv")}
            icon="pi pi-download"
            disabled={task.task_state !== TaskState.Finished}
            onClick={handleDownload}
        />
    );
};

export default TasksTable;
