import React from "react";
import { useTranslation } from "react-i18next";
import { CategoryViewType } from "../../CategoriesToolbar";
import { SelectButton } from "primereact/selectbutton";

interface SelectCategoryViewProps {
    categoryView: CategoryViewType;
    onCategoryViewChange: (viewType: CategoryViewType) => void;
}

const SelectCategoryView: React.FC<SelectCategoryViewProps> = ({
    categoryView,
    onCategoryViewChange,
}) => {
    const { t } = useTranslation("navigation");

    const displayOptions = [
        {
            label: t("categories-table"),
            icon: "pi pi-table",
            value: CategoryViewType.CategoryTable,
        },
        {
            label: t("categories-chart"),
            icon: "pi pi-chart",
            value: CategoryViewType.CategoryChart,
        },
        {
            label: t("intentions"),
            icon: "pi pi-chart",
            value: CategoryViewType.Intentions,
        },
    ];

    const handleCategoryViewChange = (e) => {
        if (e.value !== null) {
            onCategoryViewChange(e.value);
        }
    };

    return (
        <div className="flex align-items-center">
            <SelectButton
                value={categoryView}
                onChange={handleCategoryViewChange}
                options={displayOptions}
            />
        </div>
    );
};

export default SelectCategoryView;
