import { useTranslation } from "react-i18next";
import React from "react";
import { MultiSelect } from "primereact/multiselect";
import { useCategories } from "../contexts/categories/CategoriesContext";
import { Category } from "../adapters/ApiCategories";

interface AssignableCategoriesPickerProps {
    selectedCategories: Category[];
    onCategoriesChange: (categories: Category[]) => void;
    className?: string;
}

const AssignableCategoriesPicker: React.FC<AssignableCategoriesPickerProps> = (
    props
) => {
    const { t } = useTranslation();
    const { categories } = useCategories();

    const handleCategorySelect = (e: { value: Category[] }) => {
        props.onCategoriesChange(e.value);
    };

    return (
        <div className={`flex flex-column ${props.className}`}>
            <MultiSelect
                value={props.selectedCategories}
                options={categories}
                optionLabel="name"
                optionValue="id"
                onChange={handleCategorySelect}
                placeholder={t("Select categories")}
                display="chip"
            />
        </div>
    );
};

export default AssignableCategoriesPicker;
