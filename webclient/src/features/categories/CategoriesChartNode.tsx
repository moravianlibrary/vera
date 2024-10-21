import React from "react";
import CategoryPercentage from "./PercentageComponent";
import { Tooltip } from "primereact/tooltip";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import CategoryNodeEditMenu from "./CategoryActionsMenu";
import CategoryDocumentsLinkButton from "../../components/buttons/CategoryDocumentsLinkButton";
import CountInText from "../../components/views/CountInText";

interface CategoriesChartNodeProps {
    category: CategoryModel;
}

interface CategoryModelBodyProps extends CategoriesChartNodeProps {}
interface CategoryModelStatsProps extends CategoriesChartNodeProps {}

const CategoriesChartNode: React.FC<CategoriesChartNodeProps> = ({
    category,
}) => {
    const { focusCategory } = useCategoryModels();

    const getTooltipText = (): string | undefined => {
        if (category.description) {
            return `${category.name}: ${category.description}`;
        }
    };

    return (
        <div className="flex flex-column w-max">
            <div className="flex justify-content-between align-items-baseline gap-2">
                <CategoryNodeEditMenu node={category} />
                <div className="flex gap-1 justify-content-center align-items-baseline">
                    <Tooltip className="max-w-30rem" target=".category-name" />
                    <span
                        className="category-name font-bold text-lg mb-3"
                        onClick={() => focusCategory(category.id)}
                        style={{ cursor: "pointer" }}
                        data-pr-tooltip={getTooltipText()}
                    >
                        {category.name}
                    </span>
                </div>
                <CategoryPercentage category={category} />
            </div>
            <CategoryModelBody category={category} />
        </div>
    );
};

const CategoryModelBody: React.FC<CategoryModelBodyProps> = ({ category }) => {
    return (
        <div className="flex w-full align-items-end gap-2 justify-content-between">
            <div className="flex flex-column align-items-start gap-2">
                <CategoryModelExtractionStats category={category} />
                <CategoryModelStats category={category} />
            </div>
            <CategoryDocumentsLinkButton category={category} />
        </div>
    );
};

export const CategoryModelExtractionStats: React.FC<
    CategoryModelStatsProps
> = ({ category }) => {
    const { extractionId } = useCategories();

    if (!extractionId) {
        return null;
    }

    return (
        <div className="flex flex-column align-items-start">
            <CountInText
                textKey="details.extracted-page-count"
                textNs="categories"
                count={category.extracted_pages}
            />
            <CountInText
                textKey="details.extracted-document-count"
                textNs="categories"
                count={category.extracted_documents}
            />
        </div>
    );
};

const CategoryModelStats: React.FC<CategoryModelStatsProps> = ({
    category,
}) => {
    return (
        <div className="flex flex-column align-items-start gap-2">
            <CountInText.GreaterThanZero
                textKey="details.missing-page-count"
                textNs="categories"
                count={category.pages_needed_to_meet_intention}
                className="text-red-700"
            />
            <CountInText
                textKey="details.overall-percentage"
                textNs="categories"
                count={category.overall_percentage}
            />
            <div className="flex flex-column align-items-start">
                <CountInText
                    textKey="details.extractable-page-count"
                    textNs="categories"
                    count={category.extractable_pages}
                />
                <CountInText
                    textKey="details.page-count"
                    textNs="categories"
                    count={category.total_pages}
                />
            </div>
            <div className="flex flex-column align-items-start">
                <CountInText
                    textKey="details.extractable-documents-count"
                    textNs="categories"
                    count={category.extractable_documents}
                />
                <CountInText
                    textKey="details.documents-with-pages-count"
                    textNs="categories"
                    count={category.documents_with_pages}
                />
                <CountInText
                    textKey="details.documents-count"
                    textNs="categories"
                    count={category.total_documents}
                />
            </div>
        </div>
    );
};

export default CategoriesChartNode;
