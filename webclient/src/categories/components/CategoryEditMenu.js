import { useRef } from "react";

import { Button } from "primereact/button";
import { Menu } from "primereact/menu";

const CategoryEditMenu = (props) => {
    const menuRef = useRef(null);

    const handleToggleMenu = (e) => {
        menuRef.current.toggle(e);
    };

    const handleEditCategory = (e) => {
        handleToggleMenu(e);
        if (props.onEdit) {
            props.onEdit(props.node);
        }
    };

    const handleDeleteCategory = (e) => {
        handleToggleMenu(e);
        if (props.onDelete) {
            props.onDelete(props.node);
        }
    };

    const items = [
        {
            template: (item, options) => {
                return (
                    <Button className="p-1" text severity="secondary" onClick={handleEditCategory}>
                        <i className="pi pi-pencil" />
                    </Button>
                )
            }
        }, {
            separator: true
        }, {
            template: (item, options) => {
                return (
                    <Button className="p-1" text severity="secondary" onClick={handleDeleteCategory}>
                        <i className="pi pi-trash" />
                    </Button>
                )
            }
        }
    ];

    return (
        <div className="flex">
            <Menu
                className="surface-300 w-auto"
                model={items}
                popup
                popupAlignment="right"
                template={<div></div>}
                ref={menuRef} />
            <Button className="p-1" text severity="secondary" onClick={handleToggleMenu}>
                <i className="pi pi-cog" />
            </Button>
        </div>
    );
};

export default CategoryEditMenu;
