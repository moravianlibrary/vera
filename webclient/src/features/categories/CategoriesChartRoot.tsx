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

    const [missingPagesCount, setMissingPagesCount] = useState(0);

    useEffect(() => {
        setMissingPagesCount(
            Math.max(category.quota - category.count_pages, 0)
        );
    }, [category.quota]);

    return (
        <div className="flex flex-column align-items-start gap-2">
            <CategoryModelExtractionStats category={category} />
            <div className="flex flex-column align-items-start">
                {missingPagesCount > 0 && (
                    <div className="text-red-700">
                        <span className="font-bold">{missingPagesCount}</span>{" "}
                        {t("category_missing_count_pages")}
                    </div>
                )}
                {category.count_documents_without_cnb > 0 && (
                    <div className="text-red-700">
                        <span className="font-bold">
                            {category.count_documents_without_cnb}
                        </span>{" "}
                        {t("documents without CNB")}
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                <div>
                    <span className="font-bold">{category.quota}</span>{" "}
                    {t("pages by intention")}
                </div>
                <div
                    className={
                        missingPagesCount <= 0
                            ? "font-bold text-green-900"
                            : "font-bold text-red-700"
                    }
                >
                    <span>{"["}</span>
                    <Tooltip target=".fullfilment" showDelay={500} />
                    <i
                        className={
                            "fullfilment " +
                            (missingPagesCount <= 0
                                ? "pi pi-check"
                                : "pi pi-times")
                        }
                        data-pr-tooltip={
                            missingPagesCount <= 0
                                ? t("Fulfilled")
                                : t("Unfulfilled")
                        }
                    />
                    <span>{"]"}</span>
                </div>
            </div>
            <div className="flex flex-column align-items-start">
                <div>
                    <span className="font-bold">
                        {category.count_pages_extractable}
                    </span>{" "}
                    {t("extractable pages")}
                </div>
                <div>
                    <span className="font-bold">{category.count_pages}</span>{" "}
                    {t("category_count_pages")}
                </div>
            </div>
            <div className="flex flex-column align-items-start">
                <div>
                    <span className="font-bold">
                        {category.count_documents_extractable}
                    </span>{" "}
                    {t("extractable documents")}
                </div>
                <div>
                    <span className="font-bold">
                        {category.count_documents_with_pages}
                    </span>{" "}
                    {t("category_count_documents_with_pages")}
                </div>
                <div>
                    <span className="font-bold">
                        {category.count_documents}
                    </span>{" "}
                    {t("category_count_documents")}
                </div>
            </div>
        </div>
    );
};

export default CategoriesChartRoot;
