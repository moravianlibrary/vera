import React from "react";
import TasksTable from "../features/tasks/TasksTable";
import DataTableLayout from "../components/layouts/DataTableLayout";
import SubNavigationMenu from "../components/SubNavigationMenu";
import SubNavigationTasks from "../components/navigation/SubNavigationTasks";
import { TasksProvider } from "../contexts/TasksContext";
import OverlayFormLayout from "../components/layouts/OverlayFormLayout";
import TaskForm from "../components/forms/TaskForm";
import { useTranslation } from "react-i18next";
import ActionAccessComponent from "../components/access/ActionAccessComponent";
import { ActionType } from "../types/ActionType";

interface TasksProps {}

const Tasks: React.FC<TasksProps> = () => {
    const { t } = useTranslation("tasks");

    return (
        <TasksProvider>
            <DataTableLayout
                header={
                    <SubNavigationMenu
                        start={
                            <ActionAccessComponent
                                action={ActionType.AdminTasks}
                            >
                                <OverlayFormLayout
                                    buttonProps={{
                                        label: t("actions.start"),
                                    }}
                                    form={<TaskForm.Start />}
                                    visible
                                />
                            </ActionAccessComponent>
                        }
                        end={<SubNavigationTasks />}
                    />
                }
                datatable={<TasksTable />}
                paginator={<TasksTable.Paginator />}
            />
        </TasksProvider>
    );
};

export default Tasks;
