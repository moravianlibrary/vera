import React, { useEffect } from "react";

import CategoriesMenuPanel from "../features/categories/CategoriesMenuPanel";
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
import CategoriesTable from "../contexts/categories/CategoryTable";

interface CategoriesProps {}

interface CategoriesDivProps {}

const Categories: React.FC<CategoriesProps> = () => {
    return (
        <div style={{ overflow: "auto" }}>
            <CategoriesProvider>
                <DepartmentsProvider>
                    <QuotasProvider>
                        <CategoriesDiv />
                    </QuotasProvider>
                </DepartmentsProvider>
            </CategoriesProvider>
        </div>
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
            <div style={{ height: "calc(100vh - 65px)" }}>
                <CategoriesMenuPanel />
                {/* <QuotasMenuPanel /> */}
                {/* <CategoriesChart /> */}
                <CategoriesTable />
            </div>
        </CategoryNodesProvider>
    );
};

export default Categories;
