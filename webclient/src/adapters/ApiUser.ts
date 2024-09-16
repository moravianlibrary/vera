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
        return axiosInstance.get<User>(`/users/current`, { headers: authHeader() });
    }

    export function getUsers() {
        return axiosInstance.get<{ username: string }[]>(`/auth/users`, { headers: authHeader() });
    }

    export function emulateAccess(actions: ActionType[]) {
        return axiosInstance.post<User>(`/auth/users/emulate`, { actions }, { headers: authHeader() });
    }

    export function endAccessEmulation() {
        return axiosInstance.delete<User>(`/auth/users/emulate`, { headers: authHeader() });
    }
}

export default ApiUser;
export type { User };
