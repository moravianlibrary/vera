import axiosInstance, { ApiBase, ApiOptions, authHeader } from "./ApiBase";
import { TaskType } from "../types/TaskType";
import Page from "./Page";
import { EsQuery } from "./ApiTasks";

interface CronExpression {
    minute?: number | null;
    hour?: number | null;
    day_of_week?: number | null;
    day_of_month?: number | null;
}

interface PeriodicTask extends CronExpression {
    id: number;
    task_type: TaskType;
    query_params?: EsQuery | null;
}

class ApiPeriodicTasks extends ApiBase<PeriodicTask> {
    constructor() {
        super("/tasks/periodic", {
            disableGetPage: true,
            disableDelete: true,
            disableUpdate: true,
        } as ApiOptions);
    }

    updateQuery(task_id: number, query: EsQuery) {
        return axiosInstance.put(`/tasks/${task_id}/query`, query, {
            headers: authHeader(),
        });
    }

    updateSchedule(
        task_id: number,
        minute: number,
        hour: number,
        dayOfWeek: number,
        dayOfMonth: number
    ) {
        return axiosInstance.put<PeriodicTask>(
            `/tasks/${task_id}/schedule?minute=${minute}&hour=${hour}&day_of_week=${dayOfWeek}&day_of_month=${dayOfMonth}`,
            null,
            {
                headers: authHeader(),
            }
        );
    }

    getPage(page: number, pageSize: number) {
        return axiosInstance.get<Page<PeriodicTask>>(
            `/tasks/search/periodic?page=${page}&page_size=${pageSize}`,
            {
                headers: authHeader(),
            }
        );
    }
}

export default ApiPeriodicTasks;
export type { CronExpression, PeriodicTask };
