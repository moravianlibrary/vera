import axiosInstance, { authHeader } from "./ApiBase";
import { ActionType } from "../types/ActionType";
import { TaskType } from "../types/TaskType";
import { TaskState } from "../types/TaskState";
import { DocumentsQuery } from "./ApiDocuments";
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
}

interface TaskDocument {
    document_id: number;
    processed: boolean;
    error_type: string;
    error_message: string;
}

interface EsQuery {
    [key: string]: string;
}

namespace ApiTasks {
    export function planTask(task_type: TaskType, query?: EsQuery) {
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

    export function getTasks(page: number, page_size: number) {
        return axiosInstance.get<Page<Task>>(
            `/tasks?page=${page}&page_size=${page_size}`,
            { headers: authHeader() }
        );
    }

    export function getTaskDocuments(task_id: number) {
        return axiosInstance.get<TaskDocument[]>(
            `/tasks/${task_id}/documents`,
            { headers: authHeader() }
        );
    }
}

export default ApiTasks;
export type { Task, TaskDocument, EsQuery };
