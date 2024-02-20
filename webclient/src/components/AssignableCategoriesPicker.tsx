import { useTranslation } from "react-i18next";
import { useAssignableCategories } from "../contexts/categories/AssignableCategoriesContext";
import React from "react";
import { AssignableCategory } from "../adapters/ApiCategories";
import { MultiSelect } from 'primereact/multiselect';

interface AssignableCategoriesPickerProps {
    selectedCategories: AssignableCategory[];
    onCategoriesChange: (categories: AssignableCategory[]) => void;
    className?: string;
}

const AssignableCategoriesPicker: React.FC<AssignableCategoriesPickerProps> = (props) => {
    const { t } = useTranslation();
    const { categories } = useAssignableCategories();
        
    const handleCategorySelect = (e: { value: AssignableCategory[] }) => {
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
                placeholder={t('Select categories')}
                display="chip"
            />
        </div>
    );
}

export default AssignableCategoriesPicker;
