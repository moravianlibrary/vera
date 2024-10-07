import { Button } from "primereact/button";
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useEsDataTable } from "../../contexts/EsDataTableContext";
import { Badge } from "primereact/badge";
import { TieredMenu } from "primereact/tieredmenu";
import { MenuItem } from "primereact/menuitem";

interface EsSelectionMenuProps {
    actionsMenuItems: MenuItem[];
    numSelectedLabel: string;
}

const EsSelectionMenu: React.FC<EsSelectionMenuProps> = ({
    actionsMenuItems,
    numSelectedLabel,
}) => {
    const { t } = useTranslation();
    const {
        numSelected,
        areAllItemsSelected,
        setAreAllItemsSelected,
        cancelSelection,
    } = useEsDataTable();

    const actionSelectorMenuRef = useRef<TieredMenu | null>(null);

    const toggleActionSelectorMenu = (event) => {
        if (actionSelectorMenuRef.current) {
            actionSelectorMenuRef.current.toggle(event);
        }
    };

    return (
        <div className="flex flex-column align-items-end">
            <div className="flex align-items-center gap-2">
                <div className="card flex justify-content-center">
                    <TieredMenu
                        id="popup_menu_left"
                        ref={actionSelectorMenuRef}
                        className="w-auto"
                        model={actionsMenuItems}
                        popup
                        submenuIcon="pi pi-chevron-left"
                    />
                </div>
                <Button
                    icon="pi pi-objects-column"
                    className="p-button-rounded p-button-text"
                    severity={numSelected > 0 ? "help" : "secondary"}
                    disabled={numSelected === 0}
                    onClick={toggleActionSelectorMenu}
                    aria-controls="popup_menu_left"
                    aria-haspopup
                    tooltip={t("Documents actions")}
                    tooltipOptions={{ position: "top", showDelay: 500 }}
                />
                <Button
                    icon="pi pi-expand"
                    className="p-button-rounded p-button-text"
                    severity={!areAllItemsSelected ? "info" : "secondary"}
                    disabled={areAllItemsSelected}
                    onClick={() => setAreAllItemsSelected(true)}
                    tooltip={t(
                        "Select all documents that match the specified search criteria"
                    )}
                    tooltipOptions={{ position: "top", showDelay: 500 }}
                />
                <Button
                    icon="pi pi-times"
                    className="p-button-rounded p-button-text"
                    severity={numSelected > 0 ? "info" : "secondary"}
                    disabled={numSelected === 0}
                    onClick={cancelSelection}
                    tooltip={t("Cancel document selection")}
                    tooltipOptions={{ position: "top", showDelay: 500 }}
                />
            </div>
            <Badge
                className="surface-50 text-gray-600"
                value={`${t(numSelectedLabel)}: ${numSelected}`}
            />
        </div>
    );
};

export default EsSelectionMenu;
