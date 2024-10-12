import axiosInstance, { ApiBase, ApiOptions, authHeader } from "./ApiBase";
import { TaskItemErrorType, TaskItemType, TaskType } from "../types/TaskType";
import { TaskState } from "../types/TaskState";
import Page from "./Page";

interface Task {
    id: number;
    task_type: TaskType;

    owner: string;
    query_params: string | null;

    task_state: TaskState;
    planned: Date;
    started: Date | null;
    finished: Date | null;

    processed_count: number;
    total_count: number;
    error_count: number;

    errors: string[];
    has_dataset: boolean;
    dataset_error: string;
}

interface TaskItem {
    item_id: string;
    item_type: TaskItemType;
    deleted: boolean;
    processed: boolean;
    error_type: TaskItemErrorType;
    error_message: string;
}

interface EsQuery {
    index_name: string;
    query?: string;
    page?: number;
    page_size?: number;
    [key: string]: string | number | undefined;
}

class ApiTasks extends ApiBase<Task> {
    constructor() {
        super("/tasks", {
            disableGet: true,
            disableCreate: true,
            disableDelete: true,
            disableUpdate: true,
        } as ApiOptions);
    }

    planTask(task_type: TaskType, query?: EsQuery) {
        if (query) {
            return axiosInstance.post(
                `/tasks?task_type=${task_type.toString()}`,
                query,
                { headers: authHeader() }
            );
        }
        return axiosInstance.post(
            `/tasks?task_type=${task_type.toString()}`,
            null,
            { headers: authHeader() }
        );
    }

    getTaskItems(task_id: number, page: number, pageSize: number) {
        return axiosInstance.get<Page<TaskItem>>(
            `/tasks/${task_id}/items?page=${page}&page_size=${pageSize}`,
            {
                headers: authHeader(),
            }
        );
    }
}

export default ApiTasks;
export type { Task, TaskItem, EsQuery };
