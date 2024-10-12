import { IntentionClassification } from "../types/IntentionClassification";
import axiosInstance, { authHeader } from "./ApiBase";

interface IntentionCreate {
    name: string;
    description: string | null;
    target_page_count: number;
    start_date: string;
    end_date: string;
}

interface Intention extends IntentionCreate {
    id: number;
    classification: IntentionClassification;
}

interface CreateCategory {
    name: string;
    description: string | null;
    assignable: boolean;
    extract_whole: boolean;
    disabled: boolean;
    departments: number[];
}

interface Category extends CreateCategory {
    id: number;

    parent_id: number | null;
    level: number;

    predecessors_departments: number[];

    total_pages: number;
    total_documents: number;
    documents_with_pages: number;
    documents_without_cnb: number;
    extractable_pages: number;
    extractable_documents: number;

    intention_id?: number;
    percentage?: number;
    overall_percentage?: number;
    pages_needed_to_meet_intention?: number;

    extraction_id?: number;
    extracted_pages?: number;
    extracted_documents?: number;

    digitization_ids?: number[];
    digitized_pages?: number;
    digitized_documents?: number;

    sub_categories: Category[];
}

interface ChildDistribution {
    category_id: number;
    percentage: number;
}

interface ParentDistribution {
    intention_id: number;
    distributions: ChildDistribution[];
}

interface Distribution {
    intention_id: number;
    category_id: number;
    percentage: number;
    pages_needed_to_meet_intention: number;
}

namespace ApiCategories {
    export function getIntentions() {
        return axiosInstance.get<Intention[]>("/intentions", {
            headers: authHeader(),
        });
    }

    export function getCategories(departmentId: number | null = null) {
        const url = departmentId
            ? `/categories/departments/${departmentId}`
            : "/categories";
        return axiosInstance.get<Category[]>(url, { headers: authHeader() });
    }

    export function getCategoriesByIntention(
        intentionId: number,
        departmentId: number | null = null
    ) {
        const url =
            (departmentId
                ? `/categories/departments/${departmentId}`
                : "/categories") + `/in_intention/${intentionId}`;
        return axiosInstance.get<Category[]>(url, { headers: authHeader() });
    }

    export function getCategoriesForExtraction(
        intentionId: number,
        extractionId: number,
        departmentId: number | null = null
    ) {
        const url =
            (departmentId
                ? `/categories/departments/${departmentId}`
                : "/categories") +
            `/in_intention/${intentionId}/by_extraction/${extractionId}`;
        return axiosInstance.get<Category[]>(url, { headers: authHeader() });
    }

    export function getCategoriesForDigitization(
        intentionId: number,
        digitizationIds: number[] = [],
        departmentId: number | null = null
    ) {
        const url =
            (departmentId
                ? `/categories/departments/${departmentId}`
                : "/categories") +
            `/in_intention/${intentionId}/by_digitizations` +
            (digitizationIds.length > 0
                ? `?digitization_ids=${digitizationIds.join(",")}`
                : "");
        return axiosInstance.get<Category[]>(url, { headers: authHeader() });
    }

    export function createIntention(
        intention: IntentionCreate,
        copyDistributionFrom: number | null = null
    ) {
        const url = copyDistributionFrom
            ? `/intentions?copyDistributionFrom=${copyDistributionFrom}`
            : "/intentions";
        return axiosInstance.post<Intention>(url, intention, {
            headers: authHeader(),
        });
    }

    export function updateIntention(
        id: number,
        intention: IntentionCreate,
        copyDistributionFrom: number | null = null
    ) {
        const url = copyDistributionFrom
            ? `/intentions/${id}?copyDistributionFrom=${copyDistributionFrom}`
            : `/intentions/${id}`;
        return axiosInstance.put<Intention>(url, intention, {
            headers: authHeader(),
        });
    }

    export function deleteIntention(id: number) {
        return axiosInstance.delete<Intention>(`/intentions/${id}`, {
            headers: authHeader(),
        });
    }

    export function createCategory(
        category: CreateCategory,
        parentId: number | null = null
    ) {
        const url = parentId ? `/categories/${parentId}` : "/categories/root";
        return axiosInstance.post<Category>(url, category, {
            headers: authHeader(),
        });
    }

    export function updateCategory(
        categoryId: number,
        category: CreateCategory
    ) {
        return axiosInstance.put<Category>(
            `/categories/${categoryId}`,
            category,
            { headers: authHeader() }
        );
    }

    export function deleteCategory(id: number) {
        return axiosInstance.delete<Category>(`/categories/${id}`, {
            headers: authHeader(),
        });
    }

    export function updateDistribution(
        distribution: ParentDistribution,
        parentId: number | null = null
    ) {
        const url = `/categories/${parentId ? parentId : "root"}/distribution`;
        return axiosInstance.put<Category[]>(url, distribution, {
            headers: authHeader(),
        });
    }

    export function removeFromIntention(
        categoryId: number,
        intentionId: number
    ) {
        return axiosInstance.delete<Distribution[]>(
            `/categories/${categoryId}/in_intention/${intentionId}`,
            { headers: authHeader() }
        );
    }
}

export default ApiCategories;
export type {
    CreateCategory,
    Category,
    IntentionCreate,
    Intention,
    ChildDistribution,
    ParentDistribution,
};
