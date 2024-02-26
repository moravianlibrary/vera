import axiosInstance, { authHeader } from "./ApiBase";
import { ActionType } from "../types/ActionType";
import { TaskType } from "../types/TaskType";
import { TaskState } from "../types/TaskState";
import { DocumentsQuery } from "./ApiDocuments";

interface Task {
    id: number;
    task_type: TaskType;

    owner: string;
    query: string;

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

namespace ApiTasks {
    export function planTask(task_type: TaskType, query: DocumentsQuery) {
        const body = { task: {task_type: task_type}, query: query }
        return axiosInstance.post(`/tasks`, body, { headers: authHeader() });
    }

    export function getTasks(offset: number, limit: number) {
        return axiosInstance.get<Task[]>(`/tasks?offset=${offset}&limit=${limit}`, { headers: authHeader() });
    }

    export function getTaskDocuments(task_id: number) {
        return axiosInstance.get<TaskDocument[]>(`/tasks/${task_id}/documents`, { headers: authHeader() });
    }
}

export default ApiTasks;
export type { Task, TaskDocument };
