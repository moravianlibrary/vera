import axiosInstance, { authHeader } from "./ApiBase";

interface Category {
    id?: number;
    name: string;
    description?: string | null;
    parent_id?: number | null;
    assignable: boolean;
    percentage: number;
    disabled: boolean;
    departments: number[];
    level?: number | null;
    parent_category?: Category | null;
    toJson(): object;
}

interface CategoryPercentage {
    id: number;
    percentage: number;
}

interface Quota {
    id: number;
    name: string;
    description?: string | null;
    pages_count: number;
    active?: boolean;
}

namespace ApiCategories {
    export function getCategories() {
        return axiosInstance.get<Category[]>("/categories", { headers: authHeader() });
    }

    export function getAssignableCategories() {
        return axiosInstance.get<Category[]>("/categories/descriptors?assignable=true", { headers: authHeader() });
    }

    export function getRootCategories() {
        return axiosInstance.get<Category[]>("/categories/descriptors?root=true", { headers: authHeader() });
    }

    export function createCategory(category: Category) {
        return axiosInstance.post("/categories/category", category.toJson(), { headers: authHeader() });
    }

    export function updateCategory(category: Category) {
        return axiosInstance.put(`/categories/category/${category.id}`, category.toJson(), { headers: authHeader() });
    }

    export function deleteCategory(id: number) {
        return axiosInstance.delete(`/categories/category/${id}`, { headers: authHeader() });
    }

    export function updateDistribution(parent_id: number, distribution: CategoryPercentage[]) {
        if (parent_id) {
            return axiosInstance.put(`/categories/distribution?parent_id=${parent_id}`, distribution, { headers: authHeader() });
        }
        return axiosInstance.put(`/categories/distribution`, distribution, { headers: authHeader() });
    }

    export function getQuotas() {
        return axiosInstance.get<Quota[]>("/categories/quota", { headers: authHeader() });
    }

    export function createQuota(quota: Quota) {
        return axiosInstance.post("/categories/quota", quota, { headers: authHeader() });
    }

    export function updateQuota(quota: Quota) {
        return axiosInstance.put(`/categories/quota/${quota.id}`, quota, { headers: authHeader() });
    }

    export function deleteQuota(id: number) {
        return axiosInstance.delete(`/categories/quota/${id}`, { headers: authHeader() });
    }
}

export default ApiCategories;
