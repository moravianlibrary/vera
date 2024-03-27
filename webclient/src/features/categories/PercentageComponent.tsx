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

    if (editPercentageNodes.includes(node)) {
        return (
            <div ref={containerRef} className="flex align-items-center gap-1">
                <div className="p-inputgroup flex-1" style={{ width: "115px" }}>
                    <InputNumber
                        ref={inputRef}
                        className="input-percentage"
                        autoFocus={node === editPercentageNodes[0]}
                        onFocus={() => handleFocusPercentageNode(node)}
                        size={2}
                        value={node.percentage}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handlePercentageChange(
                                    node,
                                    parseFloat(
                                        (e.target as HTMLInputElement).value
                                    )
                                );
                                handleGoToNextPercentage();
                            }
                        }}
                        onChange={(e) =>
                            handlePercentageChange(node, e.value ? e.value : 0)
                        }
                        min={0}
                        max={100}
                        maxFractionDigits={2}
                        tooltip={t(
                            "You can move to the next category using the Enter key"
                        )}
                        tooltipOptions={{
                            position: "top",
                            showEvent: "click",
                            hideDelay: 3000,
                        }}
                    />
                    <span className="p-inputgroup-addon">%</span>
                </div>
                <Button
                    className="p-1"
                    text
                    severity="secondary"
                    onClick={handleUpdatePercentage}
                >
                    <i className="pi pi-check" />
                </Button>
                <Button
                    className="p-1"
                    text
                    severity="secondary"
                    onClick={handleClosePercentageEdit}
                >
                    <i className="pi pi-times" />
                </Button>
            </div>
        );
    }

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
