import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import CategoryNodeEditMenu from "./CategoryNodeEditMenu";
import { CategoryNodeExtractionStats } from "./CategoriesChartNode";
import { Tooltip } from "primereact/tooltip";

interface CategoriesChartRootProps {
    node: CategoryNode;
}

const CategoriesChartRoot: React.FC<CategoriesChartRootProps> = ({ node }) => {
    return (
        <div className="flex flex-column">
            <div className="flex justify-content-between align-items-baseline">
                <CategoryNodeEditMenu node={node} />
                <span className="font-bold text-lg mb-3">
                    {node.category.name}
                </span>
                <div></div>
            </div>
            <RootCategoryStats node={node} />
        </div>
    );
};

export const CategoriesChartLevelRoot: React.FC<CategoriesChartRootProps> = ({
    node,
}) => {
    return (
        <div className="flex flex-column">
            <span className="font-bold text-lg mb-3 text-center">
                {node.category.name}
            </span>
            <RootCategoryStats node={node} />
        </div>
    );
};

const RootCategoryStats: React.FC<CategoriesChartRootProps> = ({ node }) => {
    const { t } = useTranslation();

    const [missingPagesCount, setMissingPagesCount] = useState(0);

    useEffect(() => {
        setMissingPagesCount(Math.max(node.quota - node.count_pages, 0));
    }, [node.quota]);

    return (
        <div className="flex flex-column align-items-start gap-2">
            <CategoryNodeExtractionStats node={node} />
            <div className="flex flex-column align-items-start">
                {missingPagesCount > 0 && (
                    <div className="text-red-700">
                        <span className="font-bold">{missingPagesCount}</span>{" "}
                        {t("category_missing_count_pages")}
                    </div>
                )}
                {node.count_documents_without_cnb > 0 && (
                    <div className="text-red-700">
                        <span className="font-bold">
                            {node.count_documents_without_cnb}
                        </span>{" "}
                        {t("documents without CNB")}
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                <div>
                    <span className="font-bold">{node.quota}</span>{" "}
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
                        {node.count_pages_extractable}
                    </span>{" "}
                    {t("extractable pages")}
                </div>
                <div>
                    <span className="font-bold">{node.count_pages}</span>{" "}
                    {t("category_count_pages")}
                </div>
            </div>
            <div className="flex flex-column align-items-start">
                <div>
                    <span className="font-bold">
                        {node.count_documents_extractable}
                    </span>{" "}
                    {t("extractable documents")}
                </div>
                <div>
                    <span className="font-bold">
                        {node.count_documents_with_pages}
                    </span>{" "}
                    {t("category_count_documents_with_pages")}
                </div>
                <div>
                    <span className="font-bold">{node.count_documents}</span>{" "}
                    {t("category_count_documents")}
                </div>
            </div>
        </div>
    );
};

export default CategoriesChartRoot;
