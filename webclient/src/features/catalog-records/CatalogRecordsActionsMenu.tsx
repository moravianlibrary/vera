import { MenuItem } from "primereact/menuitem";
import { useAccess } from "../../contexts/AccessContext";
import { ActionType } from "../../types/ActionType";
import { useTranslation } from "react-i18next";
import { TaskType } from "../../types/TaskType";
import InitiateTaskStartItem from "../../components/menu-items/InitiateTaskStartItem";
import { useCatalogRecords } from "../../contexts/CatalogRecordsContext";

const CatalogRecordsActionsMenuItems = () => {
    const { t } = useTranslation("tasks");
    const { hasPermission } = useAccess();
    const { numSelected, selectedQuery } = useCatalogRecords();

    const items: MenuItem[] = [];

    if (hasPermission(ActionType.PlanTasks)) {
        const startTaskItems = [
            TaskType.ReindexCatalogRecords,
            TaskType.ReevaluateCatalogRecordsDifferences,
            TaskType.SyncCatalogRecordsWithCatalogs,
        ].map((taskType) => (
            InitiateTaskStartItem(taskType, numSelected, selectedQuery)
        ));
        items.push(...startTaskItems);
    }

    return items;
};

export default CatalogRecordsActionsMenuItems;
