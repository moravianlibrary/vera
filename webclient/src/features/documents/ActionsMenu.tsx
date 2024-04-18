import { Button } from "primereact/button";
import { ListBox } from "primereact/listbox";
import { Badge } from "primereact/badge";
import { TieredMenu } from "primereact/tieredmenu";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskType } from "../../types/TaskType";
import { useAssignableCategories } from "../../contexts/categories/AssignableCategoriesContext";
import { useDigitizationLists } from "../../contexts/extractions/DigitizationListsContext";
import { useDocumentsSearch } from "../../contexts/documents/search/DocumentsSearchContext";
import { useDocuments } from "../../contexts/documents/DocumentsContext";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import {
    CategoryOption,
    buildAssignableCategoriesOptionsTree,
} from "../../components/pickers/AssignableCategoryPicker";
import { useUser } from "../../contexts/user/UserContext";
import { ActionType } from "../../types/ActionType";
import { MenuItem } from "primereact/menuitem";
import { useDigitizationManager } from "../../contexts/extractions/DigitizationListsManagerContext";
import { useDocumentsActions } from "../../contexts/documents/DocumentsActionsContext";
import { useDocumentsSelection } from "../../contexts/documents/DocumentsSelectionContext";

interface DocumentsActionsMenuProps {}

const DocumentsActionsMenu: React.FC<DocumentsActionsMenuProps> = () => {
    const { t } = useTranslation();
    const { user } = useUser();
    const { numSelected } = useDocumentsSelection();
    const { exportDocuments, updateCategory, startTask } =
        useDocumentsActions();
    const { categories } = useAssignableCategories();
    const { digitizationLists } = useDigitizationLists();
    const {
        createDigitizationList,
        addDocumentsToDigitizationList,
        removeDocumentsFromDigitizationList,
    } = useDigitizationManager();
    const { activeQuery, activeDigitizationList } = useDocumentsSearch();

    const toggleTaskSelectorMenu = (event) => {
        if (taskSelectorMenuRef.current) {
            taskSelectorMenuRef.current.toggle(event);
        }
    };

    const confirmAction = (message: string, onAccept: () => void) => {
        confirmDialog({
            message: message,
            header: t("Confirm action"),
            icon: "pi pi-question",
            acceptLabel: t("Yes"),
            rejectLabel: t("No"),
            accept: () => onAccept(),
        });
    };

    const handleClickUpdateCategory = (
        category_id: number,
        category_name: string
    ) => {
        confirmAction(
            t(
                `Are you sure you want to change category to "{{category}}" for {{count}} selected documents?`,
                { category: category_name, count: numSelected }
            ),
            () => updateCategory(category_id, category_name)
        );
    };

    const handleClickStartTask = (taskType: TaskType) => {
        const taskMesage =
            taskType === TaskType.PredictVolumePages
                ? "Are you sure you want to predict periodical volume pages for {{count}} selected documents?"
                : taskType === TaskType.SyncFromDigitizationRegistry
                ? "Are you sure you want to sync {{count}} selected documents with digitization registry?"
                : taskType === TaskType.SyncFromCatalog
                ? "Are you sure you want to sync {{count}} selected documents with catalog?"
                : "Are you sure you want to process {{count}} selected documents?";
        confirmAction(t(taskMesage, { count: numSelected }), () =>
            startTask(taskType)
        );
    };

    const handleClickCreateDigitizationList = () => {
        confirmAction(
            t(
                `Are you sure you want to create digitization list from {{count}} selected documents?`,
                { count: numSelected }
            ),
            () => createDigitizationList()
        );
    };

    const handleClickAddToDigitizationList = (digitizationListId: number) => {
        confirmAction(
            t(
                `Are you sure you want to add {{count}} selected documents to digitization list {{digitizationListId}}?`,
                { count: numSelected, digitizationListId }
            ),
            () => addDocumentsToDigitizationList(digitizationListId)
        );
    };

    const handleClickRemoveFromDigitizationList = () => {
        if (!activeDigitizationList) {
            return;
        }
        confirmAction(
            t(
                `Are you sure you want to remove {{count}} selected documents from digitization list {{digitizationListId}}?`,
                {
                    count: numSelected,
                    digitizationListId: activeDigitizationList,
                }
            ),
            () => removeDocumentsFromDigitizationList()
        );
    };

    // TODO: refactor and move to other file
    const createCategoriesTieredMenu = () => {
        const createCategoryTieredSubMenu = (category: CategoryOption) => {
            if (category.children && category.children.length > 0) {
                return {
                    key: category.key,
                    label: category.label,
                    items: category.children.map(createCategoryTieredSubMenu),
                };
            } else if (category.selectable) {
                return {
                    label: category.label,
                    command: () =>
                        handleClickUpdateCategory(category.key, category.label),
                };
            }
        };

        return buildAssignableCategoriesOptionsTree(categories).map(
            createCategoryTieredSubMenu
        );
    };

    const createDigitizationListsTieredMenu = (): MenuItem[] => {
        return [
            {
                template: () => {
                    return (
                        <ListBox
                            className="overflow-auto"
                            style={{ maxHeight: "calc(100vh - 70px)" }}
                            options={digitizationLists.map((l) => ({
                                label: `${l.id}: ${l.extractor}, ${
                                    l.extracted_at
                                }, ${l.extracted_pages} ${t("pages")}`,
                                value: l.id,
                            }))}
                            onChange={(e) =>
                                handleClickAddToDigitizationList(
                                    e.value as number
                                )
                            }
                        />
                    );
                },
            },
        ];
    };

    const taskSelectorMenuRef = useRef<TieredMenu | null>(null);
    const exportDocumentsMenuItem = {
        label: t("Export to file"),
        icon: "pi pi-file-export",
        items: [
            {
                label: t("Export to XSLX"),
                command: () => exportDocuments(),
            },
        ],
    };
    const changeCategoryMenuItem = {
        label: t("Change category"),
        icon: "pi pi-pen-to-square",
        items: createCategoriesTieredMenu(),
    };
    const startTaskMenuItem = {
        label: t("Start task"),
        icon: "pi pi-play-circle",
        items: [
            {
                label: t("Predict volumes page counts"),
                command: () =>
                    handleClickStartTask(TaskType.PredictVolumePages),
            },
            {
                label: t("Sync from catalog"),
                command: () => handleClickStartTask(TaskType.SyncFromCatalog),
            },
            {
                label: t("Sync from digitization registry"),
                command: () =>
                    handleClickStartTask(TaskType.SyncFromDigitizationRegistry),
            },
        ],
    };
    const separatorMenuItem = {
        separator: true,
    };
    const createDigitizationListMenuItem = {
        label: t("Create digitization list"),
        icon: "pi pi-receipt",
        command: () => handleClickCreateDigitizationList(),
    };
    const addDocumentsToDigitizationListMenuItem = {
        label: t("Add documents to digitization list"),
        icon: (
            <i className="pi pi-receipt p-overlay-badge mr-2">
                <Badge
                    className="bg-transparent text-green-600 text-3xl"
                    value="+"
                />
            </i>
        ),
        items: createDigitizationListsTieredMenu(),
    };
    const removeDocumentsFromDigitizationListMenuItem = {
        label: t("Remove documents from digitization list"),
        icon: (
            <i className="pi pi-receipt p-overlay-badge mr-2">
                <Badge
                    className="bg-transparent text-red-600 text-3xl"
                    value="-"
                />
            </i>
        ),
        command: () => handleClickRemoveFromDigitizationList(),
    };

    const getActionsMenuItems = (): MenuItem[] => {
        const items: MenuItem[] = [exportDocumentsMenuItem];
        if (
            user.actions!.includes(ActionType.EditDatatableOwn) ||
            user.actions!.includes(ActionType.EditDatatableDepartment) ||
            user.actions!.includes(ActionType.EditDatatableAll)
        ) {
            items.push(changeCategoryMenuItem);
        }
        if (user.actions!.includes(ActionType.PlanTasks)) {
            items.push(startTaskMenuItem);
        }
        if (
            user.actions!.includes(ActionType.Extract) ||
            user.actions!.includes(ActionType.AdminExtractions)
        ) {
            items.push(separatorMenuItem);
        }
        if (
            user.actions!.includes(ActionType.Extract) &&
            !activeDigitizationList
        ) {
            items.push(createDigitizationListMenuItem);
        }
        if (user.actions!.includes(ActionType.AdminExtractions)) {
            if (activeDigitizationList) {
                items.push(removeDocumentsFromDigitizationListMenuItem);
            } else {
                items.push(addDocumentsToDigitizationListMenuItem);
            }
        }
        return items;
    };

    return (
        <div>
            <div className="card flex justify-content-center">
                <TieredMenu
                    className="w-auto"
                    model={getActionsMenuItems()}
                    popup
                    submenuIcon="pi pi-chevron-left"
                    ref={taskSelectorMenuRef}
                    id="popup_menu_left"
                />
            </div>
            <Button
                icon="pi pi-objects-column"
                className="p-button-rounded p-button-text"
                severity={numSelected > 0 ? "help" : "secondary"}
                disabled={numSelected === 0}
                onClick={toggleTaskSelectorMenu}
                aria-controls="popup_menu_left"
                aria-haspopup
                tooltip={t("Documents actions")}
                tooltipOptions={{ position: "top", showDelay: 500 }}
            />
            <ConfirmDialog />
        </div>
    );
};

export default DocumentsActionsMenu;
