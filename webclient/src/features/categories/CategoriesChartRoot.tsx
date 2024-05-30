import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { Tooltip } from "primereact/tooltip";
import CategoryNodeEditMenu from "./CategoryNodeEditMenu";
import { CategoryModelExtractionStats } from "./CategoriesChartNode";

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
    const { t } = useTranslation();

    return (
        <div className="flex flex-column align-items-start gap-2">
            <CategoryModelExtractionStats category={category} />
            <div className="flex flex-column align-items-start">
                {category.pages_needed_to_meet_intention &&
                    category.pages_needed_to_meet_intention > 0 && (
                        <div className="text-red-700">
                            <span className="font-bold">
                                {category.pages_needed_to_meet_intention}
                            </span>{" "}
                            {t("category_missing_count_pages")}
                        </div>
                    )}
                {category.documents_without_cnb > 0 && (
                    <div className="text-red-700">
                        <span className="font-bold">
                            {category.documents_without_cnb}
                        </span>{" "}
                        {t("documents without CNB")}
                    </div>
                )}
            </div>
            {/* <div className="flex gap-2">
                <div>
                    <span className="font-bold">
                        {category.pages_needed_to_meet_intention}
                    </span>{" "}
                    {t("pages by intention")}
                </div>
                {category.pages_needed_to_meet_intention && (
                    <div
                        className={
                            category.pages_needed_to_meet_intention <= 0
                                ? "font-bold text-green-900"
                                : "font-bold text-red-700"
                        }
                    >
                        <span>{"["}</span>
                        <Tooltip target=".fullfilment" showDelay={500} />
                        <i
                            className={
                                "fullfilment " +
                                (category.pages_needed_to_meet_intention <= 0
                                    ? "pi pi-check"
                                    : "pi pi-times")
                            }
                            data-pr-tooltip={
                                category.pages_needed_to_meet_intention <= 0
                                    ? t("Fulfilled")
                                    : t("Unfulfilled")
                            }
                        />
                        <span>{"]"}</span>
                    </div>
                )}
            </div> */}
            <div className="flex flex-column align-items-start">
                <div>
                    <span className="font-bold">
                        {category.extractable_pages}
                    </span>{" "}
                    {t("extractable pages")}
                </div>
                <div>
                    <span className="font-bold">{category.total_pages}</span>{" "}
                    {t("category_count_pages")}
                </div>
            </div>
            <div className="flex flex-column align-items-start">
                <div>
                    <span className="font-bold">
                        {category.extractable_documents}
                    </span>{" "}
                    {t("extractable documents")}
                </div>
                <div>
                    <span className="font-bold">
                        {category.documents_with_pages}
                    </span>{" "}
                    {t("category_count_documents_with_pages")}
                </div>
                <div>
                    <span className="font-bold">
                        {category.total_documents}
                    </span>{" "}
                    {t("category_count_documents")}
                </div>
            </div>
        </div>
    );
};

export default CategoriesChartRoot;
