import { MenuItem } from "primereact/menuitem";
import { useAccess } from "../../contexts/AccessContext";
import { ActionType } from "../../types/ActionType";
import { useTranslation } from "react-i18next";
import { useTasks } from "../../contexts/TasksContext";
import { TaskType } from "../../types/TaskType";
import { useEsDataTable } from "../../contexts/EsDataTableContext";

const CatalogRecordsActionsMenuItems = () => {
    const { t } = useTranslation();
    const { hasPermission } = useAccess();
    const { onInitiateTaskStart } = useTasks();
    const { numSelected, selectedQuery } = useEsDataTable();

    const items: MenuItem[] = [];

    if (hasPermission(ActionType.PlanTasks)) {
        const startTaskItems = [
            TaskType.ReindexCatalogRecords,
            TaskType.ReevaluateCatalogRecordsDifferences,
            TaskType.SyncCatalogRecordsWithCatalogs,
        ].map((taskType) => ({
            label: t(`tasks.name.${taskType}`),
            command: () =>
                onInitiateTaskStart(taskType, numSelected, selectedQuery),
        }));
        items.push(...startTaskItems);
    }

    return items;
};

export default CatalogRecordsActionsMenuItems;
