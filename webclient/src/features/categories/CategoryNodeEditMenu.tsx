import React, { useRef } from "react";

import { Button } from "primereact/button";
import { Menu } from "primereact/menu";
import { CategoryNode } from "../../contexts/categories/CategoryNodeModel";
import { MenuItem } from "primereact/menuitem";
import { useCategoryNodes } from "../../contexts/categories/CategoryNodesContext";
import { NodeType } from "../../contexts/categories/CategoryNodeType";

interface CategoryNodeEditMenuProps {
    node: CategoryNode
}

const CategoryNodeEditMenu: React.FC<CategoryNodeEditMenuProps> = ({ node }) => {
    const { handleEditCategoryNode, handleInsertChildNode, handleDeleteCategoryNode } = useCategoryNodes();
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

    return (
        <div className="flex">
            <Menu
                className="surface-300 w-auto"
                model={node.type === NodeType.Root ? rootItems : items}
                popup
                popupAlignment="right"
                ref={menuRef} />
            <Button className="p-1" text severity="secondary" onClick={handleToggleMenu}>
                <i className="pi pi-cog" />
            </Button>
        </div>
    );
};

export default CategoryNodeEditMenu;
