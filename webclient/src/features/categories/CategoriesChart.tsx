import React, { useEffect, useRef, useState } from "react";
import { OrganizationChart } from "primereact/organizationchart";
import { CategoryType } from "../../contexts/categories/CategoryType";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import CategoriesChartRoot, {
    CategoriesChartLevelRoot,
} from "./CategoriesChartRoot";
import CategoriesChartNode from "./CategoriesChartNode";
import CategoriesChartUpdate from "./CategoriesChartUpdate";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { Button } from "primereact/button";
import { useCategories } from "../../contexts/categories/CategoriesContext";

interface CategoriesChartProps {}

const SCROLL_BY_PROPORTION = 0.8;

const CategoriesChart: React.FC<CategoriesChartProps> = (props) => {
    const { currentCategory, focusParentCategory, editCategory } =
        useCategoryModels();
    const { categories } = useCategories();
    const containerRef = useRef<HTMLDivElement>(null);

    const getCategoryModelComponent = (category: CategoryModel) => {
        if (!category) {
            return;
        } else if (category.type === CategoryType.Root) {
            return <CategoriesChartRoot category={category} />;
        } else if (category.type === CategoryType.LevelRoot) {
            return <CategoriesChartLevelRoot category={category} />;
        } else if (category === editCategory) {
            return <CategoriesChartUpdate category={category} />;
        } else if (category.type === CategoryType.Category) {
            return <CategoriesChartNode category={category} />;
        } else if (category.type === CategoryType.NewCategory) {
            return <CategoriesChartUpdate category={category} />;
        }
    };

    const handleScrollLeft = (e) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) {
            return;
        }
        container.scrollBy({
            left: -(
                container.getBoundingClientRect().width * SCROLL_BY_PROPORTION
            ),
            top: 0,
            behavior: "smooth",
        });
    };

    const handleScrollRight = () => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        container.scrollBy({
            left:
                container.getBoundingClientRect().width * SCROLL_BY_PROPORTION,
            top: 0,
            behavior: "smooth",
        });
    };

    if (!currentCategory) {
        return <div></div>;
    }

    return (
        <div ref={containerRef} className="my-2">
            <Button
                className="relative mb-2"
                style={{ left: "50%", transform: "translateX(-50%)" }}
                visible={!!currentCategory.parent}
                size="large"
                rounded
                icon="pi pi-caret-up"
                onClick={() => focusParentCategory()}
            />
            <div className="card overflow-scroll overflow-y-auto">
                <OrganizationChart
                    value={[currentCategory]}
                    nodeTemplate={getCategoryModelComponent}
                />
            </div>
        </div>
    );
};

export default CategoriesChart;
