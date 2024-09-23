import React from "react";

import { Button } from "primereact/button";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { ActionType } from "../../types/ActionType";
import { useTranslation } from "react-i18next";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { useIntentions } from "../../contexts/categories/IntentionsContext";
import { CurrentUser } from "../../adapters/ApiUsers";
import ActionAccessComponent from "../../components/access/ActionAccessComponent";

interface CateogryPercentageProps {
    category: CategoryModel;
}

const CategoryPercentage: React.FC<CateogryPercentageProps> = ({
    category,
}) => {
    const { t } = useTranslation();

    const { setEditDistribution } = useCategoryModels();
    const { activeIntention } = useIntentions();

    const canEditDepartmentCategory = (user: CurrentUser) => {
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

    if (!activeIntention) {
        return <div className="px-5"></div>;
    }

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
