import { DataTable, DataTableRowEditEvent } from "primereact/datatable";
import React, { useEffect, useState } from "react";
import { useTasks } from "../../contexts/tasks/TasksContext";
import ApiTasks, { Task, TaskDocument } from "../../adapters/ApiTasks";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { TaskState } from "../../types/TaskState";
import { format, min } from "date-fns";
import { Tag } from "primereact/tag";
import { MultiSelect } from "primereact/multiselect";
import { FilterMatchMode } from "primereact/api";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { TaskType } from "../../types/TaskType";

interface TasksTableProps {}

interface TaskDocumentsProps {
    task: Task;
}

const TasksTable: React.FC<TasksTableProps> = (props) => {
    const { t } = useTranslation();
    const { tasks } = useTasks();

    const [expandedRows, setExpandedRows] = useState<Task[]>([]);

    const taskOptions = [
        {
            label: t(TaskType.GenerateVolumesPagesDataset),
            value: TaskType.GenerateVolumesPagesDataset,
        },
        {
            label: t(TaskType.GenerateItemsPagesDataset),
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

    const documentsCountBody = (task: Task) => {
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
                    onClick={() => ApiTasks.planTask(taskType as TaskType)}
                />
            </div>
        );
    };

    return (
        <DataTable
            className="documents-table"
            header={header}
            value={tasks}
            scrollable
            scrollHeight="calc(100vh - 60px)"
            expandedRows={expandedRows}
            onRowExpand={handleRowExpand}
            onRowCollapse={handleRowCollapse}
            rowExpansionTemplate={(data: Task) => <TaskDocuments task={data} />}
        >
            <Column expander style={{ width: "5rem" }} />
            <Column field="id" header={t("id")} />
            <Column body={taskTypeBody} header={t("task_type")} />
            <Column field="owner" header={t("owner")} />
            <Column body={taskStateBody} header={t("task_state")} />
            <Column body={documentsCountBody} header={t("documents_count")} />
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

const TaskDocuments: React.FC<TaskDocumentsProps> = ({ task }) => {
    const { t } = useTranslation();

    const [documents, setDocuments] = useState<TaskDocument[]>([]);
    const [showDocuments, setShowDocuments] = useState<TaskDocument[]>([]);
    const [errorTypes, setErrorTypes] = useState<string[]>([]);
    const [errorTypesFilter, setErrorTypesFilter] = useState<string[]>([]);

    useEffect(() => {
        ApiTasks.getTaskDocuments(task.id)
            .then((response) => {
                setDocuments(response.data ? response.data : []);
                setShowDocuments(response.data ? response.data : []);
                setErrorTypes([
                    ...new Set(
                        response.data
                            .map((d) =>
                                d.error_type ? d.error_type : "Without error"
                            )
                            .filter((t) => t)
                    ),
                ]);
            })
            .catch((error) => {
                console.error(`Could not receive task documents: ${error}`);
            });
    }, []);

    useEffect(() => {
        if (errorTypesFilter.length === 0) {
            setShowDocuments(documents);
            return;
        }
        setShowDocuments(
            documents.filter((document) => {
                return (
                    (errorTypesFilter.includes("Without error") &&
                        !document.error_type) ||
                    errorTypesFilter.includes(document.error_type)
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

    const processedBody = (document: TaskDocument) => {
        if (document.processed) {
            return <i className="pi pi-check text-green-700"></i>;
        } else {
            return <i className="pi pi-times text-red-700"></i>;
        }
    };

    return (
        <DataTable value={showDocuments}>
            <Column field="document_id" header={t("Document id")} />
            <Column
                field="processed"
                header={t("Processed")}
                body={processedBody}
            />
            <Column
                field="error_type"
                header={errorTypeHeader}
                body={(document) => t(document.error_type)}
            />
            <Column
                field="error_message"
                header={t("Error message")}
                body={(document) => t(document.error_message)}
            />
        </DataTable>
    );
};

export default TasksTable;
