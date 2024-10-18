import React from "react";
import PeriodicTasksTable from "../features/tasks/PeriodicTasksTable";
import DataTableLayout from "../components/layouts/DataTableLayout";
import SubNavigationMenu from "../components/SubNavigationMenu";
import { useTranslation } from "react-i18next";
import OverlayFormLayout from "../components/layouts/OverlayFormLayout";
import PeriodicTaskForm from "../components/forms/PeriodicTaskForm";
import SubNavigationTasks from "../components/navigation/SubNavigationTasks";
import {
    PeriodicTasksProvider,
    usePeriodicTasks,
} from "../contexts/PeriodicTasksContext";

interface PeriodicTasksProps {}

const PeriodicTasks: React.FC<PeriodicTasksProps> = () => {
    const { t } = useTranslation("periodic-tasks");

    return (
        <PeriodicTasksProvider>
            <DataTableLayout
                header={
                    <SubNavigationMenu
                        start={
                            <OverlayFormLayout
                                buttonProps={{
                                    label: t("actions.create"),
                                }}
                                form={<PeriodicTaskForm.Create />}
                                visible
                            />
                        }
                        end={<SubNavigationTasks />}
                    />
                }
                datatable={<PeriodicTasksTable />}
                paginator={<PeriodicTasksTable.Paginator />}
            />
        </PeriodicTasksProvider>
    );
};

export default PeriodicTasks;
