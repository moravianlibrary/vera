import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiTasks, { EsQuery, Task } from "../../adapters/ApiTasks";
import { TaskType } from "../../types/TaskType";
import { useTranslation } from "react-i18next";
import { confirmDialog } from "primereact/confirmdialog";
import { useToast } from "../ToastContext";

interface TasksContextProps {
    tasks: Task[] | undefined;
    numFound: number;
    onInitiateTaskStart: (
        taskType: TaskType,
        count?: number,
        queryParams?: any
    ) => void;
}

const TasksContext = createContext<TasksContextProps | undefined>(undefined);

interface TasksProviderProps {
    children: ReactNode;
}

export const TasksProvider: React.FC<TasksProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const [offset, setOffset] = useState<number>(0);
    const [limit, setLimit] = useState<number>(50);
    const [tasks, setTasks] = useState<Task[] | undefined>();
    const [numFound, setNumFound] = useState<number>(0);

    const loadTasks = async () => {
        ApiTasks.getTasks(offset + 1, limit)
            .then((response) => {
                const transformedData: Task[] = response.data.items.map(
                    (task) => {
                        return Object.assign({}, task) as Task;
                    }
                );
                setTasks(transformedData);
                setNumFound(response.data.num_found);
            })
            .catch((error) => {
                console.error(`Could not receive tasks: ${error}`);
            });
    };

    const startTask = async (taskType: TaskType, queryParams?: EsQuery) => {
        ApiTasks.planTask(taskType, queryParams).then((response) => {
            showToast("success", t("tasks.messages.started"), "");
        });
    };

    const onInitiateTaskStart = (
        taskType: TaskType,
        count?: number,
        queryParams?: EsQuery
    ) => {
        confirmDialog({
            message: t(`tasks.messages.confirm-start.${taskType}`, { count }),
            header: t("tasks.messages.confirm-start.header"),
            icon: "pi pi-question",
            acceptLabel: t("common.yes"),
            rejectLabel: t("common.no"),
            accept: () => startTask(taskType, queryParams),
        });
    };

    const contextValue: TasksContextProps = {
        tasks,
        numFound,
        onInitiateTaskStart,
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
        throw new Error("useTasks must be used within a TasksProvider");
    }

    return context;
};
