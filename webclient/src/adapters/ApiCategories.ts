import axiosInstance, { authHeader } from "./ApiBase";

interface CreateCategory {
    name: string;
    description: string | null;
    parent_id: number | null;

    assignable: boolean;
    disabled: boolean;
    departments: number[];
}

interface Category extends CreateCategory {
    id: number;

    percentage: number;
    level: number;

    count_pages: number;
    count_pages_extractable: number;
    count_documents: number;
    count_documents_with_pages: number;
    count_documents_extractable: number;
    count_documents_without_cnb: number;
    
    extracted_pages_count?: number;
    extracted_documents_count?: number;

    children: Category[];
}

interface AssignableCategory {
    id: number;
    name: string;
    description: string | null;
    parent_category?: AssignableCategory | null;
    children_categories?: AssignableCategory[] | null;
}

interface CategoryPercentage {
    id: number;
    percentage: number;
}

interface CreateQuota {
    name: string;
    description?: string | null;
    pages_count: number;
    active?: boolean;
}

interface Quota extends CreateQuota {
    id: number;
}

namespace ApiCategories {
    export function getCategories() {
        return axiosInstance.get<Category[]>("/categories", { headers: authHeader() });
    }

    export function getExtractionCategories(extractionId: number) {
        return axiosInstance.get<Category[]>(`/extractions/${extractionId}/categories`, { headers: authHeader() });
    }

    export function getAssignableCategories() {
        return axiosInstance.get<AssignableCategory[]>("/categories/descriptors?assignable=true", { headers: authHeader() });
    }

    export function getRootCategories() {
        return axiosInstance.get<AssignableCategory[]>("/categories/descriptors?root=true", { headers: authHeader() });
    }

    export function getCategory(categoryId: number) {
        return axiosInstance.get<AssignableCategory>(`/categories/descriptors/${categoryId}`, { headers: authHeader() });
    }

    export function createCategory(category: CreateCategory) {
        return axiosInstance.post<Category>("/categories/category", category, { headers: authHeader() });
    }

    export function updateCategory(category: Category) {
        return axiosInstance.put<Category>(`/categories/category/${category.id}`, category, { headers: authHeader() });
    }

    export function deleteCategory(id: number) {
        return axiosInstance.delete<Category>(`/categories/category/${id}`, { headers: authHeader() });
    }

    export function updateDistribution(parent_id: number | null, distribution: CategoryPercentage[]) {
        if (parent_id) {
            return axiosInstance.put(`/categories/distribution?parent_id=${parent_id}`, distribution, { headers: authHeader() });
        }
        return axiosInstance.put(`/categories/distribution`, distribution, { headers: authHeader() });
    }

    export function getQuotas() {
        return axiosInstance.get<Quota[]>("/categories/quota", { headers: authHeader() });
    }

    export function createQuota(quota: CreateQuota) {
        return axiosInstance.post<Quota>("/categories/quota", quota, { headers: authHeader() });
    }

    export function updateQuota(quota: Quota) {
        return axiosInstance.put<Quota>(`/categories/quota/${quota.id}`, quota, { headers: authHeader() });
    }

    export function deleteQuota(id: number) {
        return axiosInstance.delete<Quota>(`/categories/quota/${id}`, { headers: authHeader() });
    }
}

export default ApiCategories;
export type { CreateCategory, Category, CategoryPercentage, AssignableCategory, CreateQuota, Quota };
