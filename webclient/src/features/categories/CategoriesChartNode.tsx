import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CategoryPercentage from "./PercentageComponent";
import CategoryNodeEditMenu from "./CategoryNodeEditMenu";
import { Tooltip } from "primereact/tooltip";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { useCategories } from "../../contexts/categories/CategoriesContext";

interface CategoriesChartNodeProps {
    node: CategoryNode;
}

interface CategoryNodeBodyProps extends CategoriesChartNodeProps {}
interface CategoryNodeStatsProps extends CategoriesChartNodeProps {}

const CategoriesChartNode: React.FC<CategoriesChartNodeProps> = ({ node }) => {
    const { t } = useTranslation();
    const { handleFocusNode } = useCategoryNodes();

    const { category } = node;

    const getTooltipText = (): string | undefined => {
        if (category.description) {
            return `${category.name}: ${category.description}`;
        }
    };

    return (
        <div className="flex flex-column w-max">
            <div className="flex justify-content-between align-items-baseline gap-2">
                <CategoryNodeEditMenu node={node} />
                <div className="flex gap-1 justify-content-center align-items-baseline">
                    <Tooltip className="max-w-30rem" target=".category-name" />
                    <span
                        className="category-name font-bold text-lg mb-3"
                        onClick={() => handleFocusNode(node)}
                        style={{ cursor: "pointer" }}
                        data-pr-tooltip={getTooltipText()}
                    >
                        {node.category.name}
                    </span>
                </div>
                <CategoryPercentage node={node} />
            </div>
            <CategoryNodeBody node={node} />
        </div>
    );
};

const CategoryNodeBody: React.FC<CategoryNodeBodyProps> = ({ node }) => {
    const { t } = useTranslation();

    return (
        <div className="flex w-full align-items-end gap-2 justify-content-between">
            <div className="flex flex-column align-items-start gap-2">
                <CategoryNodeExtractionStats node={node} />
                <CategoryNodeStats node={node} />
                {/* <div className="flex flex-column"> */}
            </div>
            <CategoryDocumentsLink node={node} />
        </div>
    );
};

const CategoryDocumentsLink: React.FC<CategoryNodeStatsProps> = ({ node }) => {
    const { t } = useTranslation();

    return (
        <Link to={`/documents?categoryId=${node.category.id}`}>
            <Button
                // className="p-0 m-0 relative text-xs align-content-center"
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

export const CategoryNodeExtractionStats: React.FC<CategoryNodeStatsProps> = ({
    node,
}) => {
    const { t } = useTranslation();
    const { extractionId } = useCategories();

    if (!extractionId) {
        return null;
    }

    return (
        <div className="flex flex-column align-items-start">
            <div>
                <span className="font-bold">{node.extracted_pages_count}</span>
                {t(" extracted pages")}
            </div>
            <div>
                <span className="font-bold">
                    {node.extracted_documents_count}
                </span>
                {t(" extracted documents")}
            </div>
        </div>
    );
};

const CategoryNodeStats: React.FC<CategoryNodeStatsProps> = ({ node }) => {
    const { t } = useTranslation();

    const [missingPagesCount, setMissingPagesCount] = useState(0);

    useEffect(() => {
        setMissingPagesCount(Math.max(node.quota - node.count_pages, 0));
    }, [node.quota]);

    return (
        <div className="flex flex-column align-items-start gap-2">
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
            <div className="flex flex-column align-items-start">
                <div>
                    <span className="font-bold">{node.overallPercentage}%</span>{" "}
                    {t("from overall percentage")}
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
                    <span className="font-bold">{node.count_pages}</span>{" "}
                    {t("category_count_pages")}
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

export default CategoriesChartNode;
