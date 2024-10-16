import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiTasks, { EsQuery, Task, TaskItem } from "../adapters/ApiTasks";
import { TaskType } from "../types/TaskType";
import { useTranslation } from "react-i18next";
import { confirmDialog } from "primereact/confirmdialog";
import { useToast } from "./ToastContext";
import Page from "../adapters/Page";

interface TasksContextProps {
    tasks: Task[] | undefined;
    numFound: number;
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (pageSize: number) => void;

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
    const api = new ApiTasks();
    const { t } = useTranslation();
    const showToast = useToast();

    const [tasks, setTasks] = useState<Task[] | undefined>();
    const [numFound, setNumFound] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);

    const startTask = async (taskType: TaskType, queryParams?: EsQuery) => {
        api.planTask(taskType, queryParams).then((response) => {
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
    }, [page, pageSize]);

    const contextValue: TasksContextProps = {
        tasks,
        numFound,
        page,
        setPage,
        pageSize,
        setPageSize,

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
