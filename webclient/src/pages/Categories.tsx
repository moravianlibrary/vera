import React, { useEffect, useState } from "react";

import CategoriesToolbar, {
    CategoryViewType,
} from "../features/categories/CategoriesToolbar";
import {
    CategoriesProvider,
    useCategories,
} from "../contexts/categories/CategoriesContext";
import { DepartmentsProvider } from "../contexts/DepartmentsContext";
import { CategoryModelsProvider } from "../contexts/categories/CategoryNodesContext";
import CategoriesChart from "../features/categories/CategoriesChart";
import { useSearchParams } from "react-router-dom";
import CategoriesTable from "../features/categories/CategoryTable";
import EditDistributionMenu from "../features/categories/EditDistributionMenu";
import { IntentionsProvider } from "../contexts/categories/IntentionsContext";
import IntentionsTable from "../features/categories/IntentionsTable";
import WithProviders from "../components/wrappers/WithProviders";

interface CategoriesProps {}

const Categories: React.FC<CategoriesProps> = (props) => {
    return (
        <WithProviders
            providers={[
                CategoriesProvider,
                IntentionsProvider,
                DepartmentsProvider,
            ]}
        >
            <CategoriesContent {...props} />
        </WithProviders>
    );
};

const CategoriesContent: React.FC<CategoriesProps> = (props) => {
    const [searchParams] = useSearchParams();

    const { extractionId, setExtractionId, setDigitizationListId } =
        useCategories();

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
                    <CategoriesToolbar
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
