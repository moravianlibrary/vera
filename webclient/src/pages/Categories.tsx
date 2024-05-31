import React, { useEffect, useState } from "react";

import CategoriesMenuPanel, {
    CategoryViewType,
} from "../features/categories/CategoriesMenuPanel";
import {
    CategoriesProvider,
    useCategories,
} from "../contexts/categories/CategoriesContext";
import { DepartmentsProvider } from "../contexts/departments/DepartmentsContext";
import { CategoryModelsProvider } from "../contexts/categories/CategoryNodesContext";
import CategoriesChart from "../features/categories/CategoriesChart";
import { useSearchParams } from "react-router-dom";
import CategoriesTable from "../features/categories/CategoryTable";
import EditDistributionMenu from "../features/categories/EditDistributionMenu";
import { IntentionsProvider } from "../contexts/categories/IntentionsContext";
import IntentionsTable from "../features/categories/IntentionsTable";

interface CategoriesProps {}

interface CategoriesDivProps {}

const Categories: React.FC<CategoriesProps> = () => {
    return (
        <IntentionsProvider>
            <CategoriesProvider>
                <DepartmentsProvider>
                    <CategoriesDiv />
                </DepartmentsProvider>
            </CategoriesProvider>
        </IntentionsProvider>
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

    const getPageContent = () => {
        if (viewType === CategoryViewType.Intentions) {
            return <IntentionsTable />;
        } else if (viewType === CategoryViewType.CategoryChart) {
            return <CategoriesChart />;
        }
        return <CategoriesTable />;
    };

    return (
        <CategoryModelsProvider>
            <div className="flex flex-column w-screen overflow-auto">
                <div className="sticky top-0 right-0 z-3 gap-2 flex w-screen">
                    <CategoriesMenuPanel
                        categoryView={viewType}
                        onCategoryViewChange={setViewType}
                    />
                    <EditDistributionMenu />
                </div>
                <div>{getPageContent()}</div>
            </div>
        </CategoryModelsProvider>
    );
};

export default Categories;
