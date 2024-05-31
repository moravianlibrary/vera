import React from "react";
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
import { useIntentions } from "../../contexts/categories/IntentionsContext";

interface CategoriesTableProps {}

const CategoriesTable: React.FC<CategoriesTableProps> = (props) => {
    const { t } = useTranslation();
    const { activeIntention } = useIntentions();
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
