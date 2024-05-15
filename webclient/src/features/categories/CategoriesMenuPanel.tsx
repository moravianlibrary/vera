import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { SelectButton } from "primereact/selectbutton";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import CategoryPicker from "../../components/pickers/CategoryPicker";
import { CategoryType } from "../../contexts/categories/CategoryType";
import ExtractionPicker from "../../components/pickers/ExtractionPicker";
import { Toolbar } from "primereact/toolbar";

export enum CategoryViewType {
    CategoryTable = "CategoryTable",
    CategoryChart = "CategoryChart",
}

export enum CategorySection {
    Categories = "Categories",
    Terms = "Terms",
}

interface CategoriesMenuPanelProps {
    categoryViewType: CategoryViewType;
    onCategoryViewTypeChange: (viewType: CategoryViewType) => void;
}

const CategoriesMenuPanel: React.FC<CategoriesMenuPanelProps> = (props) => {
    const { t } = useTranslation();

    const [section, setSection] = useState<CategorySection>(
        CategorySection.Categories
    );

    const getStartContent = () => {
        if (section === CategorySection.Categories) {
            return (
                <CategoryOptions
                    categoryViewType={props.categoryViewType}
                    onCategoryViewTypeChange={props.onCategoryViewTypeChange}
                />
            );
        }
    };

    return (
        <Toolbar
            className="p-2 surface-100 w-full"
            start={getStartContent()}
            end={
                <SelectCategorySection
                    section={section}
                    onSectionChange={setSection}
                />
            }
        />
    );
};

interface CategoryOptionsProps {
    categoryViewType: CategoryViewType;
    onCategoryViewTypeChange: (viewType: CategoryViewType) => void;
}

const CategoryOptions: React.FC<CategoryOptionsProps> = ({
    categoryViewType,
    onCategoryViewTypeChange,
}) => {
    const { t } = useTranslation();
    const {
        currentCategory,
        activeLevel,
        focusAssignable,
        focusRootCategory,
        focusCategory,
        focusLevel,
        focusAssignableCategories,
    } = useCategoryModels();
    const { extractionId, setExtractionId } = useCategories();

    const levelOptions = [0, 1, 2, 3];

    const [selectedCategory, setSelectedCategory] = useState<number | null>(
        null
    );

    useEffect(() => {
        if (currentCategory) {
            setSelectedCategory(
                currentCategory.type === CategoryType.Root ||
                    currentCategory.type === CategoryType.LevelRoot
                    ? null
                    : currentCategory.id
            );
        }
    }, [currentCategory]);

    const handleFocusCategory_ = (category_id: number | null) => {
        if (category_id) {
            focusCategory(category_id);
        } else {
            focusRootCategory();
        }
    };

    return (
        <div className="flex ml-2 gap-4 flex-wrap">
            <SelectCategoryViewType
                categoryViewType={categoryViewType}
                onCategoryViewTypeChange={onCategoryViewTypeChange}
            />
            {/* <Divider layout="vertical" /> */}
            <Button
                className="m-0 text-800"
                icon="pi pi-eye"
                text
                label={t("All categories")}
                onClick={() => focusRootCategory()}
            />
            {/* <Divider layout="vertical" /> */}
            <div className="flex gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("Categories of level")}:
                </span>
                <SelectButton
                    options={levelOptions}
                    value={activeLevel}
                    onChange={(e) => focusLevel(e.value)}
                />
            </div>
            {/* <Divider layout="vertical" /> */}
            <div className="flex gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("Selected category")}:
                </span>
                <CategoryPicker
                    className={
                        selectedCategory ? "border-primary border-3" : ""
                    }
                    category_id={selectedCategory}
                    callback={handleFocusCategory_}
                />
            </div>
            {/* <Divider layout="vertical" /> */}
            <Button
                className={
                    focusAssignable
                        ? "m-0 text-800 border-yellow-500 bg-yellow-500"
                        : "m-0 text-800"
                }
                text={!focusAssignable}
                icon={focusAssignable ? "pi pi-star-fill" : "pi pi-star"}
                label={t("Assignable categories")}
                onClick={() => focusAssignableCategories()}
            />
            {/* <Divider layout="vertical" /> */}
            {/* <div className="flex gap-1 my-2 mx-1 align-items-center">
                <span className="p-button-label text-800">
                    {t("Show extraction")}:
                </span>
                <ExtractionPicker
                    extraction_id={extractionId}
                    callback={setExtractionId}
                />
            </div> */}
        </div>
    );
};

interface SelectCategoryViewTypeProps {
    categoryViewType: CategoryViewType;
    onCategoryViewTypeChange: (viewType: CategoryViewType) => void;
}

const SelectCategoryViewType: React.FC<SelectCategoryViewTypeProps> = ({
    categoryViewType,
    onCategoryViewTypeChange,
}) => {
    const { t } = useTranslation();

    const displayOptions = [
        {
            label: t("Table"),
            icon: "pi pi-table",
            value: CategoryViewType.CategoryTable,
        },
        {
            label: t("Chart"),
            icon: "pi pi-chart",
            value: CategoryViewType.CategoryChart,
        },
    ];

    const handleCategoryViewTypeChange = (e) => {
        if (e.value !== null) {
            onCategoryViewTypeChange(e.value);
        }
    };

    return (
        <div className="flex align-items-center">
            <SelectButton
                value={categoryViewType}
                onChange={handleCategoryViewTypeChange}
                options={displayOptions}
            />
        </div>
    );
};

interface SelectCategorySectionProps {
    section: CategorySection;
    onSectionChange: (section: CategorySection) => void;
}

const SelectCategorySection: React.FC<SelectCategorySectionProps> = ({
    section,
    onSectionChange,
}) => {
    const { t } = useTranslation();

    const displayOptions = [
        {
            label: t("Categories"),
            value: CategorySection.Categories,
        },
        {
            label: t("Intentions"),
            value: CategorySection.Terms,
        },
    ];

    const handleSectionChange = (e) => {
        if (e.value !== null) {
            onSectionChange(e.value);
        }
    };

    return (
        <div className="flex align-items-center mr-2">
            <SelectButton
                value={section}
                onChange={handleSectionChange}
                options={displayOptions}
            />
        </div>
    );
};

export default CategoriesMenuPanel;
