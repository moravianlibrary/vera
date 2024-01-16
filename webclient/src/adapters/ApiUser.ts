import axiosInstance, { authHeader } from "./ApiBase";
import { ActionType } from "../types/ActionType";

interface User {
    username: string;
    department_id?: number | null;
    department_name?: string | null;
    role_id: number;
    role_name: string;
    actions: ActionType[];
}

namespace ApiUser {
    export function getCurrentUser() {
        return axiosInstance.get<User>(`/auth/current_user`, { headers: authHeader() });
    }
}

export default ApiUser;
