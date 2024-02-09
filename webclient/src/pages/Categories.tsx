import React from "react";

import CategoriesMenuPanel from "../features/categories/CategoriesMenuPanel";
import QuotasMenuPanel from "../features/categories/QuotasMenuPanel";
import { CategoriesProvider, useCategories } from "../contexts/categories/CategoriesContext";
import { DepartmentsProvider, useDepartments } from "../contexts/departments/DepartmentsContext";
import { CategoryNodesProvider } from "../contexts/categories/CategoryNodesContext";
import CategoriesChart from "../features/categories/CategoriesChart";
import { QuotasProvider, useQuotas } from "../contexts/categories/QuotasContext";

interface CategoriesProps {}

interface CategoriesDivProps {}

const Categories: React.FC<CategoriesProps> = (props) => {
    return (
        <div style={{ overflow: "auto" }}>
            <CategoriesProvider>
                <DepartmentsProvider>
                    <QuotasProvider>
                        <CategoriesDiv/>
                    </QuotasProvider>
                </DepartmentsProvider>
            </CategoriesProvider>
        </div>
    );
};

const CategoriesDiv: React.FC<CategoriesDivProps> = (props) => {
    const { categories, extractionId } = useCategories();
    const { selectedQuota } = useQuotas();

    return (
        <CategoryNodesProvider
            categories={categories}
            selectedQuota={selectedQuota}
            extractedCategories={extractionId !== null}
        >
            <div
                style={{ height: "calc(100vh - 60px)" }}
            >
                <CategoriesMenuPanel />
                <QuotasMenuPanel />
                <CategoriesChart />
            </div>
        </CategoryNodesProvider>
    );
};

export default Categories;