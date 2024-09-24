import React from "react";
import { Tooltip } from "primereact/tooltip";
import { IndexDocument } from "../../../adapters/ApiDocuments";
import { useTranslation } from "react-i18next";

const CategoryColumnBody = (document: IndexDocument) => {
    const { t } = useTranslation();

    if (!document.category_path) {
        return t("documents.table.no-category");
    }
    const categoryPath = document.category_path
        .map((category) => category.category_name)
        .join(" > ");
    const categoryName =
        document.category_path[document.category_path.length - 1].category_name;
    return (
        <div>
            <Tooltip target=".documents-table-category" position="top" />
            <span
                className="documents-table-category"
                data-pr-tooltip={categoryPath}
            >
                {categoryName}
            </span>
        </div>
    );
};

export default CategoryColumnBody;
