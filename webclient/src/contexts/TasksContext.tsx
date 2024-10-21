import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
    useMemo,
} from "react";
import ApiTasks, { EsQuery, Task, TaskItem } from "../adapters/ApiTasks";
import { TaskType } from "../types/TaskType";
import { useTranslation } from "react-i18next";
import Page from "../adapters/Page";
import { useNotification } from "./NotificationContext";

interface TasksContextProps {
    tasks: Task[] | undefined;
    numFound: number;
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (pageSize: number) => void;

    startTask: (taskType: TaskType) => void;
    onInitiateTaskStart: (
        taskType: TaskType,
        count?: number,
        queryParams?: any
    ) => void;
    getTaskItems: (
        taskId: number,
        page: number,
        pageSize: number
    ) => Promise<Page<TaskItem>>;
}

const TasksContext = createContext<TasksContextProps | undefined>(undefined);

interface TasksProviderProps {
    children: ReactNode;
}

export const TasksProvider: React.FC<TasksProviderProps> = ({ children }) => {
    const api = useMemo(() => new ApiTasks(), []);
    const { t } = useTranslation("tasks");
    const { showSuccess, showConfirmDialog } = useNotification();

    const [tasks, setTasks] = useState<Task[] | undefined>();
    const [numFound, setNumFound] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);

    const startTask = async (taskType: TaskType, queryParams?: EsQuery) => {
        api.planTask(taskType, queryParams).then((response) => {
            showSuccess(t("messages.started"));
        });
    };

    const onInitiateTaskStart = (
        taskType: TaskType,
        count?: number,
        queryParams?: EsQuery
    ) => {
        showConfirmDialog(
            t(`messages.confirm-start.${taskType}`, { count }),
            () => startTask(taskType, queryParams)
        );
    };

    const getTaskItems = async (
        taskId: number,
        page: number,
        pageSize: number
    ) => {
        try {
            return (await api.getTaskItems(taskId, page, pageSize)).data;
        } catch (error) {
            console.error(`Could not fetch task documents: ${error}`);
            return { items: [], num_found: 0 };
        }
    };

    useEffect(() => {
        console.debug(`Fetching tasks from server.`);
        api.getPage(page, pageSize)
            .then((response) => {
                setTasks(response.data.items);
                setNumFound(response.data.num_found);
            })
            .catch((error) => {
                console.error(error);
            });
    }, [page, pageSize, api]);

    const contextValue: TasksContextProps = {
        tasks,
        numFound,
        page,
        setPage,
        pageSize,
        setPageSize,

        startTask,
        onInitiateTaskStart,
        getTaskItems,
    };

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
