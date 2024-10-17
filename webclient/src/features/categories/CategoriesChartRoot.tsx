import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { Tooltip } from "primereact/tooltip";
import CategoryNodeEditMenu from "./CategoryActionsMenu";
import { CategoryModelExtractionStats } from "./CategoriesChartNode";
import CountInText from "../../components/views/CountInText";

interface CategoriesChartRootProps {
    category: CategoryModel;
}

const CategoriesChartRoot: React.FC<CategoriesChartRootProps> = ({
    category,
}) => {
    return (
        <div className="flex flex-column">
            <div className="flex justify-content-between align-items-baseline">
                <CategoryNodeEditMenu node={category} />
                <span className="font-bold text-lg mb-3">{category.name}</span>
                <div></div>
            </div>
            <RootCategoryStats category={category} />
        </div>
    );
};

export const CategoriesChartLevelRoot: React.FC<CategoriesChartRootProps> = ({
    category,
}) => {
    return (
        <div className="flex flex-column">
            <span className="font-bold text-lg mb-3 text-center">
                {category.name}
            </span>
            <RootCategoryStats category={category} />
        </div>
    );
};

const RootCategoryStats: React.FC<CategoriesChartRootProps> = ({
    category,
}) => {
    return (
        <div className="flex flex-column align-items-start gap-2">
            <CategoryModelExtractionStats category={category} />
            <CountInText.GreaterThanZero
                textKey="details.missing-page-count"
                textNs="categories"
                count={category.pages_needed_to_meet_intention}
                className="text-red-700"
            />
            <div className="flex flex-column align-items-start">
                <CountInText
                    textKey="details.extractable-page-count"
                    textNs="categories"
                    count={category.extractable_pages}
                />
                <CountInText
                    textKey="details.page-count"
                    textNs="categories"
                    count={category.total_pages}
                />
            </div>
            <div className="flex flex-column align-items-start">
                <CountInText
                    textKey="details.extractable-documents-count"
                    textNs="categories"
                    count={category.extractable_documents}
                />
                <CountInText
                    textKey="details.documents-with-pages-count"
                    textNs="categories"
                    count={category.documents_with_pages}
                />
                <CountInText
                    textKey="details.documents-count"
                    textNs="categories"
                    count={category.total_documents}
                />
            </div>
        </div>
    );
};

export default CategoriesChartRoot;
