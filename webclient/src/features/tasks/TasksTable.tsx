import { DataTable, DataTableRowEditEvent } from "primereact/datatable";
import React, { useEffect, useState } from "react";
import { useTasks } from "../../contexts/TasksContext";
import ApiTasks, { Task, TaskItem } from "../../adapters/ApiTasks";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { TaskState } from "../../types/TaskState";
import { format, min } from "date-fns";
import { Tag } from "primereact/tag";
import { MultiSelect } from "primereact/multiselect";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { TaskType } from "../../types/TaskType";
import config from "../../config/config";
import DataTablePaginator from "../../components/DataTablePaginator";

interface TasksTableProps {}

interface TaskItemsProps {
    task: Task;
}

const TasksTable: React.FC<TasksTableProps> & {
    Paginator: React.FC;
} = ({}) => {
    const { t } = useTranslation();
    const { tasks } = useTasks();

    const [expandedRows, setExpandedRows] = useState<Task[]>([]);

    const taskOptions = [
        {
            label: t("Generate volumes pages dataset"),
            value: TaskType.GenerateVolumesPagesDataset,
        },
        {
            label: t("Generate items pages dataset"),
            value: TaskType.GenerateItemsPagesDataset,
        },
    ];
    const [taskType, setTaskType] = useState<TaskType | null>(null);

    const handleRowExpand = (e: DataTableRowEditEvent) => {
        setExpandedRows([...expandedRows, e.data as Task]);
    };

    const handleRowCollapse = (e: DataTableRowEditEvent) => {
        setExpandedRows(expandedRows.filter((row) => row.id !== e.data.id));
    };

    const taskTypeBody = (task: Task) => {
        return t(task.task_type);
    };

    const getTaskStateSeverity = (task: Task) => {
        switch (task.task_state) {
            case TaskState.Planned:
                return null;
            case TaskState.Running:
                return "info";
            case TaskState.Finished:
                return task.error_count === 0 ? "success" : "warning";
            case TaskState.Failed:
                return "danger";
            case TaskState.Killed:
                return "danger";
            default:
                return null;
        }
    };

    const taskStateBody = (task: Task) => {
        const label =
            task.task_state == TaskState.Finished && task.error_count > 0
                ? t("Finished with errors")
                : t(task.task_state);
        return <Tag value={label} severity={getTaskStateSeverity(task)}></Tag>;
    };

    const itemsCountBody = (task: Task) => {
        if ([TaskState.Planned, TaskState.Running].includes(task.task_state)) {
            return `${task.processed_count}/${task.total_count}`;
        }
        return `${task.total_count}`;
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

    const header = () => {
        return (
            // <div className="p-inputgroup">
            <div className="flex">
                <Dropdown
                    options={taskOptions}
                    value={taskType}
                    onChange={(e) => setTaskType(e.value)}
                />
                <Button
                    outlined
                    label={t("Plan task")}
                    disabled={taskType === null}
                    // onClick={() => ApiTasks.planTask(taskType as TaskType)}
                />
            </div>
        );
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
            <Column field="id" header={t("id")} />
            <Column body={taskTypeBody} header={t("task_type")} />
            <Column field="owner" header={t("owner")} />
            <Column body={taskStateBody} header={t("task_state")} />
            <Column body={itemsCountBody} header={t("items_count")} />
            <Column field="error_count" header={t("Error count")} />
            <Column
                body={(task) => datetimeBody(task.planned)}
                header={t("planned")}
            />
            <Column
                body={(task) => datetimeBody(task.started)}
                header={t("started")}
            />
            <Column
                body={(task) => datetimeBody(task.finished)}
                header={t("finished")}
            />
            <Column body={durationBody} header={t("duration")} />
        </DataTable>
    );
};

const TasksTablePaginator: React.FC = () => {
    const { numFound, page, setPage, pageSize, setPageSize } = useTasks();

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

TasksTable.Paginator = TasksTablePaginator;

const TaskItems: React.FC<TaskItemsProps> = ({ task }) => {
    const { t } = useTranslation();
    const { getTaskItems } = useTasks();

    const [items, setItems] = useState<TaskItem[]>([]);
    const [showItems, setShowItems] = useState<TaskItem[]>([]);
    const [errorTypes, setErrorTypes] = useState<string[]>([]);
    const [errorTypesFilter, setErrorTypesFilter] = useState<string[]>([]);
    const [page, setPage] = useState<number>(1);

    useEffect(() => {
        getTaskItems(task.id, page, 20)
            .then((taskItemsPage) => {
                setItems(taskItemsPage.items);
                setShowItems(taskItemsPage.items);
                setErrorTypes([
                    ...new Set(
                        taskItemsPage.items
                            .map((d) =>
                                d.error_type ? d.error_type : "Without error"
                            )
                            .filter((t) => t)
                    ),
                ]);
            })
            .catch((error) => {
                console.error(`Could not receive task items: ${error}`);
            });
    }, [page]);

    useEffect(() => {
        if (errorTypesFilter.length === 0) {
            setShowItems(items);
            return;
        }
        setShowItems(
            items.filter((item) => {
                return (
                    (errorTypesFilter.includes("Without error") &&
                        !item.error_type) ||
                    errorTypesFilter.includes(item.error_type)
                );
            })
        );
    }, [errorTypesFilter]);

    const errorTypeHeader = () => {
        return (
            <div className="flex justify-content-start align-items-center gap-4">
                <span>{t("Error type")}</span>
                {errorTypes.length > 1 &&
                    errorTypes.includes("Without error") && (
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
            <DataTablePaginator
                numFound={task.total_count}
                page={page}
                pageSize={20}
                onPageChangeNew={setPage}
            />
            <DataTable value={showItems}>
                <Column field="item_id" header={t("Item id")} />
                <Column
                    field="processed"
                    header={t("Processed")}
                    body={processedBody}
                />
                <Column
                    field="error_type"
                    header={errorTypeHeader}
                    body={(item) => t(item.error_type)}
                />
                <Column
                    field="error_message"
                    header={t("Error message")}
                    body={(item) => t(item.error_message)}
                />
            </DataTable>
        </div>
    );
};

const TaskCsv: React.FC<TaskItemsProps> = ({ task }) => {
    const { t } = useTranslation();
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
            label={t("Download CSV")}
            icon="pi pi-download"
            disabled={task.task_state !== TaskState.Finished}
            onClick={handleDownload}
        />
    );
};

export default TasksTable;
