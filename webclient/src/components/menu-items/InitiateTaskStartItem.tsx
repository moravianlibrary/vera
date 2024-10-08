import { MenuItem } from "primereact/menuitem";
import { useTranslation } from "react-i18next";
import { TaskType } from "../../types/TaskType";
import { useTasks } from "../../contexts/tasks/TasksContext";
import { useEsDataTable } from "../../contexts/EsDataTableContext";

const InitiateTaskStartItem = (
    taskType: TaskType,
    count?: number,
    queryParams?: any
): MenuItem => {
    const { t } = useTranslation();
    const { onInitiateTaskStart } = useTasks();

    return {
        label: t(`tasks.name.${taskType}`),
        icon: "pi pi-play-circle",
        command: () => onInitiateTaskStart(taskType, count, queryParams),
    };
};

const InitiateTaskStartItemWithEsSelection = (taskType: TaskType): MenuItem => {
    const { numSelected, selectedQuery } = useEsDataTable();

    return InitiateTaskStartItem(taskType, numSelected, selectedQuery);
};

export default InitiateTaskStartItem;
export { InitiateTaskStartItemWithEsSelection };
