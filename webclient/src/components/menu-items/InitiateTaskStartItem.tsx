import { MenuItem } from "primereact/menuitem";
import { useTranslation } from "react-i18next";
import { TaskType } from "../../types/TaskType";
import { useTasks } from "../../contexts/TasksContext";

const InitiateTaskStartItem = (
    taskType: TaskType,
    count?: number,
    queryParams?: any
): MenuItem => {
    const { t } = useTranslation("tasks");
    const { onInitiateTaskStart } = useTasks();

    return {
        label: t(`labels.${taskType}`),
        icon: "pi pi-play-circle",
        command: () => onInitiateTaskStart(taskType, count, queryParams),
    };
};

export default InitiateTaskStartItem;
