import React, { useEffect, useState } from "react";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { TreeTable, TreeTableExpandedKeysType } from "primereact/treetable";
import CategoryNodeEditMenu from "./CategoryNodeEditMenu";
import EditCategoryMenu from "./EditCategoryMenu";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { CategoryType } from "../../contexts/categories/CategoryType";

interface CategoriesTableProps {}

const CategoriesTable: React.FC<CategoriesTableProps> = (props) => {
    const { t } = useTranslation();
    const { currentCategory } = useCategoryModels();

    return (
        <div>
            <TreeTable
                className="documents-table"
                value={currentCategory ? ([currentCategory] as any) : []}
                scrollable
                scrollHeight="calc(100vh - 170px)"
                columnResizeMode="expand"
                expandedKeys={[true] as any}
            >
                <Column
                    field="category.name"
                    header={t("Category name")}
                    body={(node) => node.name}
                    expander
                />
                <Column
                    field="percentage"
                    header={t("Percentage")}
                    body={(node) => `${node.percentage}%`}
                />
                <Column
                    field="overallPercentage"
                    header={t("Overall percentage")}
                    body={(node) => `${node.overallPercentage}%`}
                />
                <Column
                    field="count_documents"
                    header={t("Extractable count")}
                    body={(node) =>
                        `${node.count_pages_extractable} ${t("pages in")} ${
                            node.count_documents_extractable
                        } ${t("documents")}`
                    }
                />
                <Column
                    field="count_pages"
                    header={t("Overall count")}
                    body={(node) =>
                        `${node.count_pages} ${t("pages in")} ${
                            node.count_documents
                        } ${t("documents")}`
                    }
                />
                <Column
                    field="count_pages"
                    header={t("Missing pages to fulfill intention")}
                    body={(node) => (
                        <DangerCountBody
                            count={Math.max(node.quota - node.count_pages, 0)}
                        />
                    )}
                />
                <Column
                    field="count_documents_without_cnb"
                    header={t("Documents without CNB")}
                    body={(node) => (
                        <DangerCountBody
                            count={node.count_documents_without_cnb}
                        />
                    )}
                />
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

interface ActionButtonsProps {
    node: CategoryModel;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ node }) => {
    const { t } = useTranslation();

    return (
        <div className="flex gap-2 align-items-center">
            <CategoryNodeEditMenu node={node} allowDistributionEdit />
            {node.type === CategoryType.Category && (
                <Link to={`/documents?categoryId=${node.id}`}>
                    <Button
                        className="p-0 text-xs"
                        icon="pi pi-external-link"
                        severity="secondary"
                        text
                        tooltip={t("Show in documents")}
                        tooltipOptions={{ position: "right", showDelay: 500 }}
                    />
                </Link>
            )}
        </div>
    );
};

interface DangerCountBodyProps {
    count: number;
}

const DangerCountBody: React.FC<DangerCountBodyProps> = ({ count }) => {
    return <span className={count > 0 ? "text-red-600" : ""}>{count}</span>;
};

export default CategoriesTable;
