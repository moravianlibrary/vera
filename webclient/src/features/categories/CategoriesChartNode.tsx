import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CategoryPercentage from "./PercentageComponent";
import CategoryNodeEditMenu from "./CategoryNodeEditMenu";
import { Tooltip } from "primereact/tooltip";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";

interface CategoriesChartNodeProps {
    node: CategoryNode
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
    }

    return (
        <div className="flex flex-column w-max">
            <div className="flex justify-content-between align-items-baseline gap-2">
                <CategoryNodeEditMenu node={node} />
                <div className="flex gap-1 justify-content-center align-items-baseline">
                    <Tooltip className="max-w-30rem" target=".category-name"  />
                    <span className="category-name font-bold text-lg mb-3"
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
        <div className="flex align-items-end gap-3">
            <CategoryNodeStats node={node} />
            <div className="flex flex-column">
                <Link to={`/documents?categoryId=${node.category.id}`}>
                    <Button
                        className='p-0 text-xs align-content-center'
                        severity='secondary'
                        text
                        tooltip={t('Show in documents')}
                    >
                        <i className='pi pi-external-link p-1' />
                    </Button>
                </Link>
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
        
    if (node.extracted) {
        return (
            <div className="flex flex-column align-items-start">
                {/* {missingPagesCount > 0 &&
                <div className="text-red-700"><span className="font-bold">{missingPagesCount}</span> {t('category_missing_count_pages')}</div>} */}
                <div>
                    <span className="font-bold">{node.extracted_pages_count}/{node.count_pages}</span>
                    {t(' extracted pages')}
                </div>
                <div>
                    <span className="font-bold">{node.extracted_documents_count}/{node.count_documents_with_pages}</span>
                    {t(' extracted documents')}
                </div>
                <div><span className="font-bold">{node.count_documents}</span> {t('category_count_documents')}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-column align-items-start">
            <div className="flex flex-column align-items-start mb-2">
                {missingPagesCount > 0 &&
                <div className="text-red-700"><span className="font-bold">{missingPagesCount}</span> {t('category_missing_count_pages')}</div>}
                {node.count_documents_without_cnb > 0 &&
                <div className="text-red-700"><span className="font-bold">{node.count_documents_without_cnb}</span> {t('documents without CNB')}</div>}
            </div>
            <div className="flex flex-column align-items-start">
                <div><span className="font-bold">{node.count_pages}</span> {t('category_count_pages')}</div>
                <div><span className="font-bold">{node.count_documents_with_pages}</span> {t('category_count_documents_with_pages')}</div>
                <div><span className="font-bold">{node.count_documents}</span> {t('category_count_documents')}</div>
            </div>
        </div>
    );
};

export default CategoriesChartNode;
