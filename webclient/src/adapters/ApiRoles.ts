import { ActionType } from "../types/ActionType";
import axiosInstance, { authHeader } from "./ApiBase";

interface Role {
    id?: number;
    name: string;
    actions: ActionType[];
}

namespace ApiRoles {
    export function getRoleNames() {
        return axiosInstance.get<string[]>(`/roles_names`, { headers: authHeader() });
    }

    export function getRoles() {
        return axiosInstance.get<Role[]>(`/roles`, { headers: authHeader() });
    }

    export function createRole(role: Role) {
        return axiosInstance.post(`/roles`, role, { headers: authHeader() });
    }

    export function updateRole(role: Role) {
        return axiosInstance.put(`/roles/${role.id}`, role, { headers: authHeader() });
    }

    export function deleteRole(id: number) {
        return axiosInstance.delete(`/roles/${id}`, { headers: authHeader() });
    }
}

export default ApiRoles;
export type { Role };
