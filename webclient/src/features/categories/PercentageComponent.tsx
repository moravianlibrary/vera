import React, { useEffect, useRef } from "react";

import { Button } from "primereact/button";
import { InputNumber } from "primereact/inputnumber";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { ActionAccessComponent } from "../../services/AccessService";
import { ActionType } from "../../types/ActionType";
import { UserModel } from "../../contexts/user/UserModel";
import { useTranslation } from "react-i18next";
import { Tooltip } from "primereact/tooltip";

interface CateogryPercentageProps {
    node: CategoryNode;
}

const CategoryPercentage: React.FC<CateogryPercentageProps> = ({ node }) => {
    const { t } = useTranslation();

    const {
        handleEditPercentage,
        editPercentageNodes,
        handlePercentageChange,
        handleUpdatePercentage,
        handleClosePercentageEdit,
        focusEditPercentageIndex,
        handleGoToNextPercentage,
        handleFocusPercentageNode,
    } = useCategoryNodes();

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<InputNumber>(null);

    useEffect(() => {
        if (
            editPercentageNodes[focusEditPercentageIndex] === node &&
            containerRef.current &&
            inputRef.current
        ) {
            containerRef.current.scrollIntoView();
            inputRef.current.focus();
        }
    }, [focusEditPercentageIndex]);

    const canEditDepartmentCategory = (user: UserModel) => {
        return (node.category.level >= 1 &&
            user.actions &&
            user.department_id &&
            user.actions.includes(ActionType.EditCategoriesDepartment) &&
            node.category.departments.includes(user.department_id)) as boolean;
    };

    return (
        <div className="flex align-items-center">
            <div>
                <span className="font-bold">[</span>
                <span>{node.percentage}%</span>
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
                    onClick={() => handleEditPercentage(node)}
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
