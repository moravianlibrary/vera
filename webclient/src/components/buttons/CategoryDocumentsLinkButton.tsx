import { useTranslation } from "react-i18next";
import { Category } from "../../adapters/ApiCategories";
import { Link } from "react-router-dom";
import { Button } from "primereact/button";

interface CategoryDocumentsLinkButtonProps {
    category: Category;
}

const CategoryDocumentsLinkButton: React.FC<
    CategoryDocumentsLinkButtonProps
> = ({ category }) => {
    const { t } = useTranslation("categories");
    return (
        <Link to={`/documents?categoryId=${category.id}`}>
            <Button
                className="p-0 m-0 text-xs"
                severity="secondary"
                text
                tooltip={t("actions.show-in-documents")}
                tooltipOptions={{ position: "right", showDelay: 500 }}
            >
                <i className="pi pi-external-link p-1" />
            </Button>
        </Link>
    );
};

export default CategoryDocumentsLinkButton;
