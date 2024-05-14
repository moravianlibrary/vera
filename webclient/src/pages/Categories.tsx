import React, { useEffect, useState } from "react";

import CategoriesMenuPanel, {
    CategorySection,
    CategoryViewType,
} from "../features/categories/CategoriesMenuPanel";
import QuotasMenuPanel from "../features/categories/QuotasMenuPanel";
import {
    CategoriesProvider,
    useCategories,
} from "../contexts/categories/CategoriesContext";
import {
    DepartmentsProvider,
    useDepartments,
} from "../contexts/departments/DepartmentsContext";
import { CategoryNodesProvider } from "../contexts/categories/CategoryNodesContext";
import CategoriesChart from "../features/categories/CategoriesChart";
import {
    QuotasProvider,
    useQuotas,
} from "../contexts/categories/QuotasContext";
import { useSearchParams } from "react-router-dom";
import CategoriesTable from "../features/categories/CategoryTable";
import EditCategoryMenu from "../contexts/categories/EditCategoryMenu";
import EditDistributionMenu from "../features/categories/EditDistributionMenu";

interface CategoriesProps {}

interface CategoriesDivProps {}

const Categories: React.FC<CategoriesProps> = () => {
    return (
        <CategoriesProvider>
            <DepartmentsProvider>
                <QuotasProvider>
                    <CategoriesDiv />
                </QuotasProvider>
            </DepartmentsProvider>
        </CategoriesProvider>
    );
};

const CategoriesDiv: React.FC<CategoriesDivProps> = (props) => {
    const [searchParams, setSearchParams] = useSearchParams();

    const {
        categories,
        extractionId,
        setExtractionId,
        digitizationListId,
        setDigitizationListId,
    } = useCategories();
    const { selectedQuota } = useQuotas();

    const [viewType, setViewType] = useState<CategoryViewType>(
        CategoryViewType.CategoryTable
    );

    useEffect(() => {
        if (searchParams.has("extractionId")) {
            setExtractionId(parseInt(searchParams.get("extractionId")!, 10));
        } else if (searchParams.has("digitizationListId")) {
            setDigitizationListId(
                parseInt(searchParams.get("digitizationListId")!, 10)
            );
        }
    }, [searchParams, setExtractionId]);

    return (
        <CategoryNodesProvider
            categories={categories}
            selectedQuota={selectedQuota}
            extractedCategories={
                extractionId !== null || digitizationListId !== null
            }
        >
            <div className="flex flex-column w-screen overflow-auto">
                <div className="sticky top-0 right-0 z-3 gap-2 flex w-screen">
                    <CategoriesMenuPanel
                        categoryViewType={viewType}
                        onCategoryViewTypeChange={setViewType}
                    />
                    <EditCategoryMenu />
                    <EditDistributionMenu />
                </div>
                <div>
                    {viewType === CategoryViewType.CategoryTable && (
                        <CategoriesTable />
                    )}
                    {viewType === CategoryViewType.CategoryChart && (
                        <CategoriesChart />
                    )}
                </div>
            </div>
        </CategoryNodesProvider>
    );
};

export default Categories;
