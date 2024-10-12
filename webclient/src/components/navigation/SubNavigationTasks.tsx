import React from "react";
import { useTranslation } from "react-i18next";
import { ActionType } from "../../types/ActionType";
import { useAccess } from "../../contexts/AccessContext";
import NavigationButtonGroup from "./NavigationButtonGroup";

interface SubNavigationTasksProps {}

const SubNavigationTasks: React.FC<SubNavigationTasksProps> = () => {
    const { t } = useTranslation();
    const { hasPermission } = useAccess();

    if (
        !hasPermission(ActionType.PlanTasks) ||
        !hasPermission(ActionType.AdminTasks)
    ) {
        return null;
    }

    return (
        <NavigationButtonGroup
            navigationButtons={[
                {
                    label: t("navigation.tasks"),
                    to: "/tasks",
                    action: ActionType.PlanTasks,
                },
                {
                    label: t("navigation.periodic-tasks"),
                    to: "/tasks/periodic",
                    action: ActionType.AdminTasks,
                },
            ]}
        />
    );
};

export default SubNavigationTasks;
