import React from "react";
import { useCategoryNodes } from "./CategoryNodesContext";
import { DataTable } from "primereact/datatable";
import DataTablePaginator from "../../components/DataTablePaginator";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";
import { TreeTable } from "primereact/treetable";

interface CategoriesTableProps {}

const CategoriesTable: React.FC<CategoriesTableProps> = (props) => {
    const { t } = useTranslation();
    const { categoryNodes, handleFocusParentNode } = useCategoryNodes();

    console.log(categoryNodes);

    return (
        <div>
            <TreeTable
                className="documents-table"
                value={categoryNodes}
                scrollable
                scrollHeight="calc(100vh - 170px)"
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
                    body={(node) => Math.max(node.quota - node.count_pages, 0)}
                />
            </TreeTable>
        </div>
    );
};

export default CategoriesTable;
