import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import CategoryNodeEditMenu from "./CategoryNodeEditMenu";

interface CategoriesChartRootProps {
    node: CategoryNode
}

const CategoriesChartRoot: React.FC<CategoriesChartRootProps> = ({ node }) => {
    const { t } = useTranslation();

    const { category } = node;
    const [missingPagesCount, setMissingPagesCount] = useState(0);

    useEffect(() => {
        setMissingPagesCount(Math.max(node.quota - node.count_pages, 0));
    }, [node.quota]);

    return (
    <div className="flex flex-column">
            <div className="flex justify-content-between align-items-baseline">
                <CategoryNodeEditMenu node={node} />
                <span className="font-bold text-lg mb-3">
                    {node.category.name}
                </span>
                <div></div>
            </div>
            <div className="flex flex-column align-items-start">
                {missingPagesCount > 0 &&
                <div className="text-red-700"><span className="font-bold">{missingPagesCount}</span> {t('category_missing_count_pages')}</div>}
                {node.count_documents_without_cnb > 0 &&
                <div className="text-red-700"><span className="font-bold">{node.count_documents_without_cnb}</span> {t('documents without CNB')}</div>}
                <div><span className="font-bold">{node.count_pages}</span> {t('category_count_pages')}</div>
                <div><span className="font-bold">{node.count_documents_with_pages}</span> {t('category_count_documents_with_pages')}</div>
                <div><span className="font-bold">{node.count_documents}</span> {t('category_count_documents')}</div>
            </div>
        </div>
    );
};

export default CategoriesChartRoot;
