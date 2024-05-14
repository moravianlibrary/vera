import React from "react";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { TreeTable } from "primereact/treetable";
import { ColumnGroup } from "primereact/columngroup";
import EditButton from "../../components/buttons/EditButton";
import { Row } from "primereact/row";
import DeleteButton from "../../components/buttons/DeleteButton";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { NodeType } from "../../contexts/categories/CategoryNodeType";
import { Button } from "primereact/button";
import CategoryNodeEditMenu from "./CategoryNodeEditMenu";

interface CategoriesTableProps {}

const CategoriesTable: React.FC<CategoriesTableProps> = (props) => {
    const { t } = useTranslation();
    const { categoryNodes, setEditCategory, handleDeleteCategoryNode } =
        useCategoryNodes();

    return (
        <div>
            <TreeTable
                className="documents-table"
                value={categoryNodes}
                scrollable
                scrollHeight="calc(100vh - 170px)"
                columnResizeMode="expand"
            >
                <Column
                    field="category.name"
                    header={t("Category name")}
                    body={(node) => node.category.name}
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
                    header={t("Missing pages")}
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
                    body={(node) => (
                        <CategoryNodeEditMenu
                            node={node}
                            allowDistributionEdit
                        />
                    )}
                />
            </TreeTable>
        </div>
    );
};

interface DangerCountBodyProps {
    count: number;
}

const DangerCountBody: React.FC<DangerCountBodyProps> = ({ count }) => {
    return <span className={count > 0 ? "text-red-600" : ""}>{count}</span>;
};

interface ActionButtonsProps {
    category: CategoryNode;
    onEditCategory: (category: CategoryNode) => void;
    onDeleteCategory: (category: CategoryNode) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
    category,
    onEditCategory,
    onDeleteCategory,
}) => {
    if (category.type === NodeType.Root) {
        return <Button icon="pi pi-plus" text rounded />;
    }

    return (
        <div>
            <Button icon="pi pi-calculator" text rounded />
            <EditButton onEdit={() => onEditCategory(category)} />
            <Button icon="pi pi-plus" text rounded />
            <DeleteButton onDelete={() => onDeleteCategory(category)} />
        </div>
    );
};

export default CategoriesTable;
