import axiosInstance, { authHeader } from "./ApiBase";

interface Department {
    id: number;
    name: string;
}

namespace ApiDepartments {
    export function getDepartments() {
        return axiosInstance.get<Department[]>("/departments", { headers: authHeader() });
    }

    export function createDepartment(department: Department) {
        return axiosInstance.post("/departments", department, { headers: authHeader() });
    }

    export function updateDepartment(department: Department) {
        return axiosInstance.put(`/departments/${department.id}`, department, { headers: authHeader() });
    }

    export function deleteDepartment(id: number) {
        return axiosInstance.delete(`/departments/${id}`, { headers: authHeader() });
    }
}

export default ApiDepartments;
