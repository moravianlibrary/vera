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
    const { t } = useTranslation("categories");
    const { activeIntention } = useIntentions();
    const { currentCategory } = useCategoryModels();

    return (
        <div>
            <TreeTable
                className="documents-table"
                value={currentCategory ? ([currentCategory] as any) : []}
                scrollable
                scrollHeight="flex"
            >
                <Column
                    style={{ width: "300px" }}
                    field="category.name"
                    header={t("table.columns.name")}
                    expander
                    body={(node, options) => <CategoryNameBody node={node} />}
                />
                {activeIntention && (
                    <Column
                        style={{ width: "80px" }}
                        field="percentage"
                        header={t("table.columns.percentage")}
                        body={(node) =>
                            t("table.values.percentage", {
                                percentage: node.percentage || 0,
                            })
                        }
                    />
                )}
                {activeIntention && (
                    <Column
                        style={{ width: "80px" }}
                        field="overall_percentage"
                        header={t("table.columns.overall-percentage")}
                        body={(node) =>
                            t("table.values.overall-percentage", {
                                percentage: node.percentage || 0,
                            })
                        }
                    />
                )}
                <Column
                    style={{ width: "100px" }}
                    field="total"
                    header={t("table.columns.overall-count")}
                    body={(node) =>
                        t("table.values.overall-count", {
                            page_count: node.total_pages || 0,
                            count: node.total_documents || 0,
                        })
                    }
                />
                <Column
                    style={{ width: "120px" }}
                    field="extractable"
                    header={t("table.columns.extractable-count")}
                    body={(node) =>
                        t("table.values.extractable-count", {
                            page_count: node.extractable_pages || 0,
                            count: node.extractable_documents || 0,
                        })
                    }
                />
                {activeIntention && (
                    <Column
                        style={{ width: "100px" }}
                        field="count_pages"
                        header={t("table.columns.missing-to-fulfill")}
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
                        header={t("table.columns.actions")}
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
    const { t } = useTranslation("categories");

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
            <Link
                to={`/documents?index_name=documents&category_ids=${node.id}`}
            >
                <Button
                    className="p-1 text-xs"
                    icon="pi pi-external-link"
                    iconPos="right"
                    severity="secondary"
                    text
                    tooltip={t("actions.show-in-documents")}
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
