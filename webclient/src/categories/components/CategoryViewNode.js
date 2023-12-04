import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import CategoryEditMenu from "./CategoryEditMenu";
import PercentageComponent from "./PercentageComponent";
import NodeType from "../models/CategoryNodeType";

const CategoryViewNode = (props) => {
    const { node } = props;
    const { t } = useTranslation();


    const { category } = node;
    const [missingPagesCount, setMissingPagesCount] = useState(0);

    useEffect(() => {
        setMissingPagesCount(Math.max(node.quota - category.count_pages, 0));
    }, [node.quota]);

    const handleClick = () => {
        if (props.onClick) {
            props.onClick(node);
        }
    };

    return (
    <div className="flex flex-column">
            <div className="flex justify-content-between align-items-baseline gap-2">
                {node.type == NodeType.CATEGORY && <CategoryEditMenu {...props} />}
                <span className="font-bold text-lg mb-3"
                    onClick={() => handleClick()}
                    style={{ cursor: "pointer" }}
                >
                    {node.category.name}
                </span>
                {node.type == NodeType.CATEGORY &&
                    <PercentageComponent percentage={node.category.percentage} {...props} />
                }
            </div>
            <div className="flex flex-column align-items-start">
                {missingPagesCount > 0 &&
                <div><span className="font-bold warning">{missingPagesCount}</span> {t('category_missing_count_pages')}</div>}
                {node.category.description && <span>{category.description}</span>}
                <div><span className="font-bold">{category.count_pages}</span> {t('category_count_pages')}</div>
                <div><span className="font-bold">{category.count_documents_with_pages}</span> {t('category_count_documents_with_pages')}</div>
                <div><span className="font-bold">{category.count_documents}</span> {t('category_count_documents')}</div>
            </div>
        </div>
    );
};

export default CategoryViewNode;
