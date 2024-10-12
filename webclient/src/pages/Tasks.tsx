import React from "react";
import TasksTable from "../features/tasks/TasksTable";
import DataTableLayout from "../components/layouts/DataTableLayout";
import SubNavigationMenu from "../components/SubNavigationMenu";
import SubNavigationTasks from "../components/navigation/SubNavigationTasks";
import { TasksProvider } from "../contexts/TasksContext";

interface TasksProps {}

const Tasks: React.FC<TasksProps> = () => {
    return (
        <TasksProvider>
            <DataTableLayout
                header={
                    <SubNavigationMenu end={() => <SubNavigationTasks />} />
                }
                datatable={<TasksTable />}
                paginator={<TasksTable.Paginator />}
            />
        </TasksProvider>
    );
};

export default Tasks;
