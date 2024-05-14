import React, { useRef } from "react";

import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { MenuItem } from "primereact/menuitem";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { NodeType } from "../../contexts/categories/CategoryNodeType";
import { ActionAccessComponent } from "../../services/AccessService";
import { ActionType } from "../../types/ActionType";
import { UserModel } from "../../contexts/user/UserModel";
import { useUser } from "../../contexts/user/UserContext";
import { useTranslation } from "react-i18next";

interface CategoryNodeEditMenuProps {
    node: CategoryNode;
    allowDistributionEdit?: boolean;
}

const MAX_CATEGORY_LEVEL = 3;

const CategoryNodeEditMenu: React.FC<CategoryNodeEditMenuProps> = ({
    node,
    allowDistributionEdit,
}) => {
    const { t } = useTranslation();
    const {
        handleEditCategoryNode: editCategoryNode,
        handleInsertChildNode: insertChildNode,
        handleDeleteCategoryNode: deleteCategoryNode,
        setEditDistribution,
    } = useCategoryNodes();
    const { user } = useUser();
    const menuRef = useRef(null);

    const handleToggleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (menuRef.current) {
            (menuRef.current as Menu).toggle(event);
        }
    };

    const handleEditCategoryNode = (node: CategoryNode) => {
        editCategoryNode(node);
        handleToggleMenu({} as React.MouseEvent<HTMLButtonElement>);
    };

    const handleInsertChildNode = (node: CategoryNode) => {
        insertChildNode(node);
        handleToggleMenu({} as React.MouseEvent<HTMLButtonElement>);
    };

    const handleDeleteCategoryNode = (node: CategoryNode) => {
        deleteCategoryNode(node);
        handleToggleMenu({} as React.MouseEvent<HTMLButtonElement>);
    };

    const handleEditDistribution = () => {
        setEditDistribution(node);
        handleToggleMenu({} as React.MouseEvent<HTMLButtonElement>);
    };

    const editDistributionButton = (node: CategoryNode) => {
        return (
            <Button
                className="p-2"
                label={t("Edit distribution")}
                icon="pi pi-calculator"
                text
                severity="secondary"
                onClick={() => handleEditDistribution()}
            />
        );
    };

    const addChildCategoryButton = (node: CategoryNode) => {
        return (
            <Button
                className="p-2"
                label={t("Add child category")}
                icon="pi pi-plus"
                text
                severity="secondary"
                onClick={() => handleInsertChildNode(node)}
            />
        );
    };

    const editCategoryButton = (node: CategoryNode) => {
        return (
            <Button
                className="p-2"
                label={t("Edit category")}
                icon="pi pi-pencil"
                text
                severity="secondary"
                onClick={() => handleEditCategoryNode(node)}
            />
        );
    };

    const deleteCategoryButton = (node: CategoryNode) => {
        return (
            <Button
                className="p-2"
                label={t("Delete category")}
                icon="pi pi-trash"
                text
                severity="secondary"
                onClick={() => handleDeleteCategoryNode(node)}
            />
        );
    };

    const editDistributionItems: MenuItem[] = [
        {
            template: (item, options) => editDistributionButton(node),
        },
        {
            separator: true,
        },
    ];

    const rootItems: MenuItem[] = [
        {
            template: (item, options) => addChildCategoryButton(node),
        },
    ];

    const items: MenuItem[] = [
        {
            template: (item, options) => addChildCategoryButton(node),
        },
        {
            separator: true,
        },
        {
            template: (item, options) => editCategoryButton(node),
        },
        {
            separator: true,
        },
        {
            template: (item, options) => deleteCategoryButton(node),
        },
    ];

    const leafItems: MenuItem[] = [
        {
            template: (item, options) => editCategoryButton(node),
        },
        {
            separator: true,
        },
        {
            template: (item, options) => deleteCategoryButton(node),
        },
    ];

    const getMenuItems = () => {
        if (node.type === NodeType.Root) {
            return allowDistributionEdit
                ? editDistributionItems.concat(rootItems)
                : rootItems;
        } else if (
            node.category.assignable ||
            node.category.level === MAX_CATEGORY_LEVEL
        ) {
            return leafItems;
        } else if (user.actions!.includes(ActionType.EditCategoriesAll)) {
            return allowDistributionEdit
                ? editDistributionItems.concat(items)
                : items;
        } else if (
            user.actions!.includes(ActionType.EditCategoriesDepartment)
        ) {
            if (node.category.level >= 1) {
                return allowDistributionEdit
                    ? editDistributionItems.concat(items)
                    : items;
            } else {
                return allowDistributionEdit
                    ? editDistributionItems.concat(rootItems)
                    : rootItems;
            }
            return node.category.level >= 1 ? items : rootItems;
        } else {
            return [];
        }
    };

    const canEditDepartmentCategory = (user: UserModel) => {
        return (user.actions &&
            user.department_id &&
            user.actions.includes(ActionType.EditCategoriesDepartment) &&
            node.category.departments.includes(user.department_id)) as boolean;
    };

    return (
        <div className="flex">
            <ActionAccessComponent
                action={ActionType.EditCategoriesAll}
                evaluate={canEditDepartmentCategory}
            >
                <Menu
                    className="surface-50 w-auto"
                    model={getMenuItems()}
                    popup
                    popupAlignment="right"
                    ref={menuRef}
                />
                <Button
                    className="p-1"
                    text
                    severity="secondary"
                    onClick={handleToggleMenu}
                    tooltip={t("Category options")}
                    tooltipOptions={{ position: "left", showDelay: 1000 }}
                >
                    <i className="pi pi-cog" />
                </Button>
            </ActionAccessComponent>
        </div>
    );
};

export default CategoryNodeEditMenu;
