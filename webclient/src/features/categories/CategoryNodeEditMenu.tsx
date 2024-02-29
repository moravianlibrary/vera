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

interface CategoryNodeEditMenuProps {
    node: CategoryNode
}

const CategoryNodeEditMenu: React.FC<CategoryNodeEditMenuProps> = ({ node }) => {
    const { handleEditCategoryNode, handleInsertChildNode, handleDeleteCategoryNode } = useCategoryNodes();
    const { user } = useUser();
    const menuRef = useRef(null);

    const handleToggleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (menuRef.current) {
            (menuRef.current as Menu).toggle(event);
        }
    };
    const rootItems: MenuItem[] = [{
            template: (item, options) => {
                return (
                    <Button className="p-2" text severity="secondary" onClick={() => handleInsertChildNode(node)}>
                        <i className="pi pi-plus" />
                    </Button>
                )
            }
        }
    ];

    const items: MenuItem[] = [
        {
            template: (item, options) => {
                return (
                    <Button className="p-2" text severity="secondary" onClick={() => handleEditCategoryNode(node)}>
                        <i className="pi pi-pencil" />
                    </Button>
                )
            }
        }, {
            separator: true
        }, {
            template: (item, options) => {
                return (
                    <Button className="p-2" text severity="secondary" onClick={() => handleDeleteCategoryNode(node)}>
                        <i className="pi pi-trash" />
                    </Button>
                )
            }
        }, {
            separator: true
        } , {
            template: (item, options) => {
                return (
                    <Button className="p-2" text severity="secondary" onClick={() => handleInsertChildNode(node)}>
                        <i className="pi pi-plus" />
                    </Button>
                )
            }
        }
    ];

    const getMenuItems = () => {
        if (node.type === NodeType.Root) {
            return rootItems;
        } else if (user.actions!.includes(ActionType.EditCategoriesAll)) {
            return items;
        } else if (user.actions!.includes(ActionType.EditCategoriesDepartment)) {
            return node.category.level >= 1 ? items : rootItems;
        } else {
            return [];
        }
    }

    const canEditDepartmentCategory = (user: UserModel) => {
        return (user.actions
                && user.department_id
                && user.actions.includes(ActionType.EditCategoriesDepartment)
                && node.category.departments.includes(user.department_id)) as boolean;
    }

    return (
        <div className="flex">
            <ActionAccessComponent
                action={ActionType.EditCategoriesAll}
                evaluate={canEditDepartmentCategory}
            >
                <Menu
                    className="surface-300 w-auto"
                    model={getMenuItems()}
                    popup
                    popupAlignment="right"
                    ref={menuRef} />
                <Button className="p-1" text severity="secondary" onClick={handleToggleMenu}>
                    <i className="pi pi-cog" />
                </Button>
            </ActionAccessComponent>
        </div>
    );
};

export default CategoryNodeEditMenu;
