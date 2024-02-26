import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiTasks, { Task } from "../../adapters/ApiTasks";

interface TasksContextProps {
    tasks: Task[] | undefined;
}

const TasksContext = createContext<TasksContextProps | undefined>(undefined);

interface TasksProviderProps {
    children: ReactNode;
}

export const TasksProvider: React.FC<TasksProviderProps> = ({ children }) => {
    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(50);
    const [tasks, setTasks] = useState<Task[] | undefined>();

    const loadTasks = async () => {
        ApiTasks.getTasks(offset, limit)
        .then(response => {
            const transformedData: Task[] = response.data.map(task => {
                return Object.assign({}, task) as Task;
            });
            setTasks(transformedData);
        }).catch(error => {
            console.error(`Could not receive tasks: ${error}`);
        });
    };

    const contextValue: TasksContextProps = {
        tasks,
    };

    useEffect(() => {
        loadTasks();
    }, []);

    return (
        <TasksContext.Provider value={contextValue}>
            {children}
        </TasksContext.Provider>
    );
};

export const useTasks = (): TasksContextProps => {
    const context = useContext(TasksContext);

    if (!context) {
        throw new Error('useTasks must be used within a TasksProvider');
    }

    return context;
};
