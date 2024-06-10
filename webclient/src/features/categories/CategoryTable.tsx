import React from "react";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { TreeTable } from "primereact/treetable";
import CategoryNodeEditMenu from "./CategoryActionsMenu";
import EditCategoryMenu from "./EditCategoryMenu";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { Button } from "primereact/button";
import { Link } from "react-router-dom";
import { CategoryType } from "../../contexts/categories/CategoryType";
import { useIntentions } from "../../contexts/categories/IntentionsContext";
import { IntentionClassification } from "../../types/IntentionClassification";

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
                // columnResizeMode="expand"
                // resizableColumns
            >
                <Column
                    style={{ width: "300px" }}
                    field="category.name"
                    header={t("Category name")}
                    expander
                    body={(node, options) => <CategoryNameBody node={node} />}
                />
                {activeIntention && (
                    <Column
                        style={{ width: "80px" }}
                        field="percentage"
                        header={t("Percentage")}
                        body={(node) => `${node.percentage || 0}%`}
                    />
                )}
                {activeIntention && (
                    <Column
                        style={{ width: "80px" }}
                        field="overall_percentage"
                        header={t("Overall percentage")}
                        body={(node) => `${node.overall_percentage || 0}%`}
                    />
                )}
                <Column
                    style={{ width: "100px" }}
                    field="total"
                    header={t("Overall count")}
                    body={(node) =>
                        `${node.total_pages} ${t("pages in")} ${
                            node.total_documents
                        } ${t("documents")}`
                    }
                />
                <Column
                    style={{ width: "120px" }}
                    field="extractable"
                    header={t("Extractable count")}
                    body={(node) =>
                        `${node.extractable_pages} ${t("pages in")} ${
                            node.extractable_documents
                        } ${t("documents")}`
                    }
                />
                <Column
                    style={{ width: "100px" }}
                    field="count_documents_without_cnb"
                    header={t("Documents without CNB")}
                    body={(node) => (
                        <DangerCountBody count={node.documents_without_cnb} />
                    )}
                />
                {activeIntention && (
                    <Column
                        style={{ width: "100px" }}
                        field="count_pages"
                        header={t("Missing pages to fulfill intention")}
                        body={(node) => (
                            <DangerCountBody
                                count={node.pages_needed_to_meet_intention}
                            />
                        )}
                    />
                )}
                {(activeIntention === null ||
                    activeIntention.classification !==
                        IntentionClassification.Previous) && (
                    <Column
                        style={{ width: "80px" }}
                        field="actions"
                        header={t("Actions")}
                        body={(node) => <ActionButtons node={node} />}
                    />
                )}
            </TreeTable>
            <EditCategoryMenu />
        </div>
    );
};

interface CategoryColumnBodyProps {
    node: CategoryModel;
}

const CategoryNameBody: React.FC<CategoryColumnBodyProps> = ({ node }) => {
    const { t } = useTranslation();

    if (node.type !== CategoryType.Category) {
        return <span>{node.name}</span>;
    }

    return (
        <span
            style={{
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                overflow: "ellipsis",
            }}
        >
            {node.name}
            <Link to={`/documents?categoryId=${node.id}`}>
                <Button
                    className="p-1 text-xs"
                    icon="pi pi-external-link"
                    iconPos="right"
                    severity="secondary"
                    text
                    tooltip={t("Show in documents")}
                    tooltipOptions={{ position: "right", showDelay: 500 }}
                />
            </Link>
        </span>
    );
};

const ActionButtons: React.FC<CategoryColumnBodyProps> = ({ node }) => {
    return <CategoryNodeEditMenu node={node} allowDistributionEdit />;
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
