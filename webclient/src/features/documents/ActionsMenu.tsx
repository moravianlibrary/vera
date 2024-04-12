import { Button } from "primereact/button";
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

interface DocumentsActionsMenuProps {}

const DocumentsActionsMenu: React.FC<DocumentsActionsMenuProps> = () => {
    const { t } = useTranslation();
    const {
        selectedDocuments,
        selectAll,
        handleExportDocuments,
        handleUpdateCategory,
        handleStartTask,
    } = useDocuments();
    const { categories } = useAssignableCategories();
    const { createDigitizationList } = useDigitizationLists();
    const { activeQuery } = useDocumentsSearch();

    const [hasSelection, setHasSelection] = useState(false);

    useEffect(() => {
        setHasSelection(selectedDocuments.length > 0);
    }, [selectedDocuments]);

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
                { category: category_name, count: selectedDocuments.length }
            ),
            () => handleUpdateCategory(category_id, category_name)
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
        confirmAction(t(taskMesage, { count: selectedDocuments.length }), () =>
            handleStartTask(taskType)
        );
    };

    const handleClickCreateDigitizationList = () => {
        confirmAction(
            t(
                `Are you sure you want to create digitization list from {{count}} selected documents?`,
                { count: selectedDocuments.length }
            ),
            () =>
                createDigitizationList(
                    selectAll
                        ? activeQuery!
                        : { id_list: selectedDocuments.map((d) => d.id) }
                )
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

    const taskSelectorMenuRef = useRef<TieredMenu | null>(null);
    const taskSelectorItems = [
        {
            label: t("Export to file"),
            icon: "pi pi-file-export",
            items: [
                {
                    label: t("Export to XSLX"),
                    command: () => handleExportDocuments(),
                },
            ],
        },
        {
            label: t("Change category"),
            icon: "pi pi-pen-to-square",
            items: createCategoriesTieredMenu(),
        },
        {
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
                    command: () =>
                        handleClickStartTask(TaskType.SyncFromCatalog),
                },
                {
                    label: t("Sync from digitization registry"),
                    command: () =>
                        handleClickStartTask(
                            TaskType.SyncFromDigitizationRegistry
                        ),
                },
            ],
        },
        {
            separator: true,
        },
        {
            label: t("Create digitization list"),
            icon: "pi pi-receipt",
            command: () => handleClickCreateDigitizationList(),
        },
    ];

    return (
        <div>
            <div className="card flex justify-content-center">
                <TieredMenu
                    className="w-auto"
                    model={taskSelectorItems}
                    popup
                    submenuIcon="pi pi-chevron-left"
                    ref={taskSelectorMenuRef}
                    id="popup_menu_left"
                />
            </div>
            <Button
                icon="pi pi-objects-column"
                className="p-button-rounded p-button-text"
                severity={hasSelection ? "help" : "secondary"}
                disabled={!hasSelection}
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
