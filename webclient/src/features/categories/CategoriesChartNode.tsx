import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CategoryPercentage from "./PercentageComponent";
import { Tooltip } from "primereact/tooltip";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import CategoryNodeEditMenu from "./CategoryActionsMenu";

interface CategoriesChartNodeProps {
    category: CategoryModel;
}

interface CategoryModelBodyProps extends CategoriesChartNodeProps {}
interface CategoryModelStatsProps extends CategoriesChartNodeProps {}

const CategoriesChartNode: React.FC<CategoriesChartNodeProps> = ({
    category,
}) => {
    const { t } = useTranslation();
    const { focusCategory } = useCategoryModels();

    const getTooltipText = (): string | undefined => {
        if (category.description) {
            return `${category.name}: ${category.description}`;
        }
    };

    return (
        <div className="flex flex-column w-max">
            <div className="flex justify-content-between align-items-baseline gap-2">
                <CategoryNodeEditMenu node={category} />
                <div className="flex gap-1 justify-content-center align-items-baseline">
                    <Tooltip className="max-w-30rem" target=".category-name" />
                    <span
                        className="category-name font-bold text-lg mb-3"
                        onClick={() => focusCategory(category.id)}
                        style={{ cursor: "pointer" }}
                        data-pr-tooltip={getTooltipText()}
                    >
                        {category.name}
                    </span>
                </div>
                <CategoryPercentage category={category} />
            </div>
            <CategoryModelBody category={category} />
        </div>
    );
};

const CategoryModelBody: React.FC<CategoryModelBodyProps> = ({ category }) => {
    const { t } = useTranslation();

    return (
        <div className="flex w-full align-items-end gap-2 justify-content-between">
            <div className="flex flex-column align-items-start gap-2">
                <CategoryModelExtractionStats category={category} />
                <CategoryModelStats category={category} />
                {/* <div className="flex flex-column"> */}
            </div>
            <CategoryDocumentsLink category={category} />
        </div>
    );
};

const CategoryDocumentsLink: React.FC<CategoryModelStatsProps> = ({
    category,
}) => {
    const { t } = useTranslation();

    return (
        <Link to={`/documents?categoryId=${category.id}`}>
            <Button
                className="p-0 m-0 text-xs"
                severity="secondary"
                text
                tooltip={t("Show in documents")}
                tooltipOptions={{ position: "right", showDelay: 500 }}
            >
                <i className="pi pi-external-link p-1" />
            </Button>
        </Link>
    );
};

export const CategoryModelExtractionStats: React.FC<
    CategoryModelStatsProps
> = ({ category }) => {
    const { t } = useTranslation();
    const { extractionId } = useCategories();

    if (!extractionId) {
        return null;
    }

    return (
        <div className="flex flex-column align-items-start">
            <div>
                <span className="font-bold">{category.extracted_pages}</span>
                {t(" extracted pages")}
            </div>
            <div>
                <span className="font-bold">
                    {category.extracted_documents}
                </span>
                {t(" extracted documents")}
            </div>
        </div>
    );
};

const CategoryModelStats: React.FC<CategoryModelStatsProps> = ({
    category,
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-column align-items-start gap-2">
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
            <div className="flex gap-1 align-items-start">
                <div>
                    <span className="font-bold">
                        {category.overall_percentage}%
                    </span>{" "}
                    {t("from overall percentage")}
                </div>
                <div className="flex gap-2">
                    {/* TODO: maybe add property to category
                    <div>
                        <span className="font-bold">{category.quota}</span>{" "}
                        {t("pages by intention")}
                    </div> */}
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
                                    (category.pages_needed_to_meet_intention <=
                                    0
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
                    {/* {missingPagesCount == 0 && (
                        <span className="font-bold text-green-900">{`[${t(
                            "Fulfilled"
                        )}]`}</span>
                    )}
                    {missingPagesCount > 0 && (
                        <span className="font-bold text-red-700">{`[${t(
                            "Unfulfilled"
                        )}]`}</span>
                    )} */}
                </div>
            </div>
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

export default CategoriesChartNode;
