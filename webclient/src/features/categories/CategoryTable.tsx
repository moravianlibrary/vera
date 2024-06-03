import React, { useState } from "react";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { Column, ColumnBodyOptions } from "primereact/column";
import { useTranslation } from "react-i18next";
import { TreeTable, TreeTableExpandedKeysType } from "primereact/treetable";
import CategoryNodeEditMenu from "./CategoryNodeEditMenu";
import EditCategoryMenu from "./EditCategoryMenu";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { CategoryType } from "../../contexts/categories/CategoryType";
import { useIntentions } from "../../contexts/categories/IntentionsContext";

interface CategoriesTableProps {}

const CategoriesTable: React.FC<CategoriesTableProps> = (props) => {
    const { t } = useTranslation();
    const { activeIntention } = useIntentions();
    const { currentCategory } = useCategoryModels();

    const [expandedKeys, setExpandedKeys] = useState<TreeTableExpandedKeysType>(
        {}
    );

    const toggleApplications = () => {
        let _expandedKeys = { ...expandedKeys };

        if (_expandedKeys["0"]) delete _expandedKeys["0"];
        else _expandedKeys["0"] = true;

        setExpandedKeys(_expandedKeys);
    };

    const handleExpand = (category: CategoryModel) => {
        console.log(category);
        toggleApplications();
    };

    return (
        <div>
            <TreeTable
                className="documents-table"
                value={currentCategory ? ([currentCategory] as any) : []}
                scrollable
                scrollHeight="calc(100vh - 170px)"
                columnResizeMode="expand"
                expandedKeys={expandedKeys}
                onToggle={(e) => setExpandedKeys(e.value)}
            >
                <Column
                    field="category.name"
                    header={t("Category name")}
                    expander
                    body={(node, options) => (
                        <CategoryNameBody
                            node={node}
                            options={options}
                            onExpand={handleExpand}
                        />
                    )}
                />
                {activeIntention && (
                    <Column
                        field="percentage"
                        header={t("Percentage")}
                        body={(node) => `${node.percentage || 0}%`}
                    />
                )}
                {activeIntention && (
                    <Column
                        field="overall_percentage"
                        header={t("Overall percentage")}
                        body={(node) => `${node.overall_percentage || 0}%`}
                    />
                )}
                <Column
                    field="total"
                    header={t("Overall count")}
                    body={(node) =>
                        `${node.total_pages} ${t("pages in")} ${
                            node.total_documents
                        } ${t("documents")}`
                    }
                />
                <Column
                    field="extractable"
                    header={t("Extractable count")}
                    body={(node) =>
                        `${node.extractable_pages} ${t("pages in")} ${
                            node.extractable_documents
                        } ${t("documents")}`
                    }
                />
                <Column
                    field="count_documents_without_cnb"
                    header={t("Documents without CNB")}
                    body={(node) => (
                        <DangerCountBody count={node.documents_without_cnb} />
                    )}
                />
                {activeIntention && (
                    <Column
                        field="count_pages"
                        header={t("Missing pages to fulfill intention")}
                        body={(node) => (
                            <DangerCountBody
                                count={node.pages_needed_to_meet_intention}
                            />
                        )}
                    />
                )}
                <Column
                    field="actions"
                    header={t("Actions")}
                    body={(node) => <ActionButtons node={node} />}
                />
            </TreeTable>
            <EditCategoryMenu />
        </div>
    );
};

interface CategoryColumnBodyProps {
    node: CategoryModel;
}

interface CategoryNameBodyProps extends CategoryColumnBodyProps {
    options: ColumnBodyOptions;
    onExpand: (node: CategoryModel) => void;
}

const CategoryNameBody: React.FC<CategoryNameBodyProps> = ({
    node,
    options,
    onExpand,
}) => {
    const { t } = useTranslation();
    console.log(options);

    if (node.type !== CategoryType.Category) {
        return <span>{node.name}</span>;
    }

    return (
        <>
            <span>{node.name}</span>
            <Link to={`/documents?categoryId=${node.id}`}>
                <Button
                    // className="p-0 text-xs"
                    className="p-2"
                    icon="pi pi-external-link"
                    iconPos="right"
                    severity="secondary"
                    text
                    // label={node.name}
                    tooltip={t("Show in documents")}
                    tooltipOptions={{ position: "right", showDelay: 500 }}
                />
            </Link>
        </>
    );
};

const ActionButtons: React.FC<CategoryColumnBodyProps> = ({ node }) => {
    const { t } = useTranslation();

    return (
        <div className="flex gap-2 align-items-center">
            <CategoryNodeEditMenu node={node} allowDistributionEdit />
        </div>
    );
};

interface DangerCountBodyProps {
    count: number;
}

const DangerCountBody: React.FC<DangerCountBodyProps> = ({ count }) => {
    if (count > 0) {
        return <span className="text-red-600">{count}</span>;
    }
    if (count === 0) {
        return <span>{count}</span>;
    }
    return <span>+{-count}</span>;
};

export default CategoriesTable;
