import React from "react";

import { Button } from "primereact/button";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { ActionAccessComponent } from "../../services/AccessService";
import { ActionType } from "../../types/ActionType";
import { UserModel } from "../../contexts/user/UserModel";
import { useTranslation } from "react-i18next";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";

interface CateogryPercentageProps {
    category: CategoryModel;
}

const CategoryPercentage: React.FC<CateogryPercentageProps> = ({
    category,
}) => {
    const { t } = useTranslation();

    const { setEditDistribution } = useCategoryModels();

    const canEditDepartmentCategory = (user: UserModel) => {
        return (category.level >= 1 &&
            user.actions &&
            user.department_id &&
            user.actions.includes(ActionType.EditCategoriesDepartment) &&
            category.departments.includes(user.department_id)) as boolean;
    };

    const handleEditDistribution = () => {
        if (category.parent) {
            setEditDistribution(category.parent);
        }
    };

    return (
        <div className="flex align-items-center">
            <div>
                <span className="font-bold">[</span>
                <span>{category.percentage}%</span>
                <span className="font-bold">]</span>
            </div>
            <ActionAccessComponent
                action={ActionType.EditCategoriesAll}
                evaluate={canEditDepartmentCategory}
            >
                <Button
                    className="p-1"
                    text
                    severity="secondary"
                    onClick={handleEditDistribution}
                    tooltip={t("Edit distribution")}
                    tooltipOptions={{ position: "right", showDelay: 500 }}
                >
                    <i className="pi pi-pencil" />
                </Button>
            </ActionAccessComponent>
        </div>
    );
};

export default CategoryPercentage;
