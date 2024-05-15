import React, { useRef } from "react";

import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { CategoryModel } from "../../contexts/categories/CategoryModel";
import { MenuItem } from "primereact/menuitem";
import { useCategoryModels } from "../../contexts/categories/CategoryNodesContext";
import { CategoryType } from "../../contexts/categories/CategoryType";
import { ActionAccessComponent } from "../../services/AccessService";
import { ActionType } from "../../types/ActionType";
import { UserModel } from "../../contexts/user/UserModel";
import { useUser } from "../../contexts/user/UserContext";
import { useTranslation } from "react-i18next";

interface CategoryEditMenuProps {
    node: CategoryModel;
    allowDistributionEdit?: boolean;
}

const MAX_CATEGORY_LEVEL = 3;

const CategoryNodeEditMenu: React.FC<CategoryEditMenuProps> = ({
    node,
    allowDistributionEdit,
}) => {
    const { t } = useTranslation();
    const {
        addCategory,
        openCategoryEdit,
        deleteCategory,
        setEditDistribution,
    } = useCategoryModels();
    const { user } = useUser();
    const menuRef = useRef(null);

    const handleToggleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (menuRef.current) {
            (menuRef.current as Menu).toggle(event);
        }
    };

    const handleEditCategoryModel = (node: CategoryModel) => {
        openCategoryEdit(node);
        handleToggleMenu({} as React.MouseEvent<HTMLButtonElement>);
    };

    const handleInsertChildNode = (node: CategoryModel) => {
        addCategory(node);
        handleToggleMenu({} as React.MouseEvent<HTMLButtonElement>);
    };

    const handleDeleteCategoryModel = (node: CategoryModel) => {
        deleteCategory(node);
        handleToggleMenu({} as React.MouseEvent<HTMLButtonElement>);
    };

    const handleEditDistribution = () => {
        setEditDistribution(node);
        handleToggleMenu({} as React.MouseEvent<HTMLButtonElement>);
    };

    const editDistributionButton = (node: CategoryModel) => {
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

    const addChildCategoryButton = (node: CategoryModel) => {
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

    const editCategoryButton = (node: CategoryModel) => {
        return (
            <Button
                className="p-2"
                label={t("Edit category")}
                icon="pi pi-pencil"
                text
                severity="secondary"
                onClick={() => handleEditCategoryModel(node)}
            />
        );
    };

    const deleteCategoryButton = (node: CategoryModel) => {
        return (
            <Button
                className="p-2"
                label={t("Delete category")}
                icon="pi pi-trash"
                text
                severity="secondary"
                onClick={() => handleDeleteCategoryModel(node)}
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
        const editDistribution =
            allowDistributionEdit && node.children.length > 0;
        if (node.type === CategoryType.Root) {
            return editDistribution
                ? editDistributionItems.concat(rootItems)
                : rootItems;
        } else if (node.assignable || node.level === MAX_CATEGORY_LEVEL) {
            return leafItems;
        } else if (user.actions!.includes(ActionType.EditCategoriesAll)) {
            return editDistribution
                ? editDistributionItems.concat(items)
                : items;
        } else if (
            user.actions!.includes(ActionType.EditCategoriesDepartment)
        ) {
            if (node.level >= 1) {
                return editDistribution
                    ? editDistributionItems.concat(items)
                    : items;
            } else {
                return editDistribution
                    ? editDistributionItems.concat(rootItems)
                    : rootItems;
            }
        } else {
            return [];
        }
    };

    const canEditDepartmentCategory = (user: UserModel) => {
        return (user.actions &&
            user.department_id &&
            user.actions.includes(ActionType.EditCategoriesDepartment) &&
            node.departments.includes(user.department_id)) as boolean;
    };

    if (
        node.type !== CategoryType.Root &&
        node.type !== CategoryType.Category
    ) {
        return null;
    }

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
