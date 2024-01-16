import axiosInstance, { authHeader } from "./ApiBase";

interface Category {
    id: number;
    toJson(): object;
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

    export function updateDistribution(parent_id: number, distribution: any) {
        if (parent_id) {
            return axiosInstance.put(`/categories/distribution?parent_id=${parent_id}`, distribution, { headers: authHeader() });
        }
        return axiosInstance.put(`/categories/distribution`, distribution, { headers: authHeader() });
    }

    export function getQuotas() {
        return axiosInstance.get("/categories/quota", { headers: authHeader() });
    }

    export function createQuota(quota: any) {
        return axiosInstance.post("/categories/quota", quota, { headers: authHeader() });
    }

    export function updateQuota(quota: any) {
        return axiosInstance.put(`/categories/quota/${quota.id}`, quota, { headers: authHeader() });
    }

    export function deleteQuota(id: number) {
        return axiosInstance.delete(`/categories/quota/${id}`, { headers: authHeader() });
    }
}

export default ApiCategories;
