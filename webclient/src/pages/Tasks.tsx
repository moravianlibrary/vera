import React from 'react';
import TasksTable from '../features/tasks/TasksTable';
import { TasksProvider } from '../contexts/tasks/TasksContext';

interface TasksProps {
}

const Tasks: React.FC<TasksProps> = (props) => {
    return (
        <div>
            <TasksProvider>
                <TasksTable />
            </TasksProvider>
        </div>
    );
}

export default Tasks;
