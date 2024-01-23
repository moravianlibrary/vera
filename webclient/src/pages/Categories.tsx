import React from "react";

import CategoriesMenuPanel from "../features/categories/CategoriesMenuPanel";
import QuotasMenuPanel from "../features/categories/QuotasMenuPanel";
import { CategoriesProvider, useCategories } from "../contexts/categories/CategoriesContext";
import { DepartmentsProvider, useDepartments } from "../contexts/departments/DepartmentsContext";
import { CategoryNodesProvider } from "../contexts/categories/CategoryNodesContext";
import CategoriesChart from "../features/categories/CategoriesChart";

interface CategoriesProps {}

interface CategoriesDivProps {}

const Categories: React.FC<CategoriesProps> = (props) => {
    return (
        <div style={{ overflow: "auto" }}>
            <CategoriesProvider>
                <DepartmentsProvider>
                    <CategoriesDiv/>
                </DepartmentsProvider>
            </CategoriesProvider>
        </div>
    );
};

const CategoriesDiv: React.FC<CategoriesDivProps> = (props) => {
    const { categories } = useCategories();
    const { departments } = useDepartments();
    const quotas = [];

    return (
        <CategoryNodesProvider
            categories={categories}
            departments={departments}
            quotas={quotas}
        >
            <div style={{ overflow: "auto" }}>
                <CategoriesMenuPanel />
                <QuotasMenuPanel />
                <CategoriesChart />
            </div>
        </CategoryNodesProvider>
    );
};

export default Categories;