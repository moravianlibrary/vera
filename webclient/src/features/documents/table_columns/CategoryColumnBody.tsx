import { Tooltip } from "primereact/tooltip";
import { IndexDocument } from "../../../adapters/ApiDocuments";

const CategoryColumnBody = (document: IndexDocument) => {
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
