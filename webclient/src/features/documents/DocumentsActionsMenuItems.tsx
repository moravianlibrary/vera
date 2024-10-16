import React from "react";
import { MenuItem } from "primereact/menuitem";
import { useTranslation } from "react-i18next";
import { useAccess } from "../../contexts/AccessContext";
import { ActionType } from "../../types/ActionType";
import {
    CategoryOption,
    buildAssignableCategoriesOptionsTree,
} from "../../components/pickers/AssignableCategoryPicker";
import { useCategories } from "../../contexts/categories/CategoriesContext";
import { confirmDialog } from "primereact/confirmdialog";
import { useDocuments } from "../../contexts/DocumentsContext";
import { TaskType } from "../../types/TaskType";
import InitiateTaskStartItem from "../../components/menu-items/InitiateTaskStartItem";
import { Badge } from "primereact/badge";
import DigitizationListBox from "../../components/DigitizationListBox";
import { useDigitizationLists } from "../../contexts/DigitizationListsContext";
import { useIntentions } from "../../contexts/categories/IntentionsContext";

const DocumentsActionsMenuItems = () => {
    const { t } = useTranslation();
    const { hasPermission } = useAccess();
    const {
        numSelected,
        selectedQuery,
        exportDocuments,
        updateCategory,
        updateExtractionPriority,
        deleteDocuments,
        digitizationListIdFacets,
    } = useDocuments();
    const { categories } = useCategories();
    const { activeIntention } = useIntentions();
    const {
        onInitiateListCreation,
        onInitiateListItemsAddition,
        onInitiateListItemsRemoval,
    } = useDigitizationLists();

    const createCategoriesTieredMenu = () => {
        const createCategoryTieredSubMenu = (category: CategoryOption) => {
            if (category.children && category.children.length > 0) {
                return {
                    key: category.key,
                    label: category.label,
                    items: category.children
                        .map(createCategoryTieredSubMenu)
                        .filter((item) => item),
                };
            } else if (category.selectable) {
                return {
                    label: category.label,
                    command: () => updateCategory(category.key, category.label),
                };
            }
        };

        return categories
            ? buildAssignableCategoriesOptionsTree(categories)
                  .map(createCategoryTieredSubMenu)
                  .filter((item) => item)
            : [];
    };

    const items: MenuItem[] = [];

    const exportDocumentsMenuItem = {
        label: t("documents.actions.export"),
        icon: "pi pi-file-export",
        items: [
            {
                label: t("documents.actions.export-to-xslx"),
                command: () => exportDocuments(),
            },
        ],
    };
    items.push(exportDocumentsMenuItem);

    if (hasPermission(ActionType.EditDatatable)) {
        const changeCategoryMenuItem = {
            label: t("documents.actions.update-category.label"),
            icon: "pi pi-tags",
            items: createCategoriesTieredMenu(),
        };
        items.push(changeCategoryMenuItem);
        const changePriorityMenuItem = {
            label: t("documents.actions.update-extraction-priority.label"),
            icon: "pi pi-star",
            items: Array.from({ length: 5 }, (_, index) => ({
                label: t(`documents.extraction-priority.${5 - index}`),
                command: () => updateExtractionPriority(5 - index),
            })),
        };
        items.push(changePriorityMenuItem);
        items.push({ separator: true });
        const deleteMenuItem = {
            label: t("documents.actions.delete.label"),
            icon: "pi pi-trash",
            className: "text-red-500",
            command: () => deleteDocuments(),
        };
        items.push(deleteMenuItem);
    }

    if (hasPermission(ActionType.PlanTasks)) {
        items.push({ separator: true });
        [
            TaskType.PredictPeriodicalsPageCount,
            TaskType.ReindexDocuments,
            TaskType.SyncDocumentsWithCatalogs,
            TaskType.SyncDocumentsWithDigitizationRegistry,
        ].forEach((taskType) => {
            items.push(
                InitiateTaskStartItem(taskType, numSelected, selectedQuery)
            );
        });
    }

    if (
        hasPermission(ActionType.Extract) ||
        hasPermission(ActionType.AdminExtractions)
    ) {
        items.push({ separator: true });
    }

    if (hasPermission(ActionType.Extract) && activeIntention) {
        const createDigitizationListMenuItem = {
            label: t("documents.actions.create-digitization-list"),
            icon: "pi pi-receipt",
            command: () =>
                onInitiateListCreation(
                    numSelected,
                    selectedQuery,
                    activeIntention.id
                ),
        };
        items.push(createDigitizationListMenuItem);
    }

    if (
        hasPermission(ActionType.AdminExtractions) &&
        digitizationListIdFacets.length === 0
    ) {
        const addDocumentsToDigitizationListMenuItem = {
            label: t("documents.actions.add-to-digitization-list"),
            icon: (
                <i className="pi pi-receipt p-overlay-badge mr-2">
                    <Badge
                        className="bg-transparent text-green-600 text-3xl"
                        value="+"
                    />
                </i>
            ),
            items: [
                {
                    template: () => (
                        <DigitizationListBox
                            callback={(digitizationListId) =>
                                onInitiateListItemsAddition(
                                    numSelected,
                                    selectedQuery,
                                    digitizationListId
                                )
                            }
                        />
                    ),
                },
            ],
        };
        items.push(addDocumentsToDigitizationListMenuItem);
    }

    if (
        hasPermission(ActionType.AdminExtractions) &&
        digitizationListIdFacets.length === 1
    ) {
        const removeDocumentsFromDigitizationListMenuItem = {
            label: t("documents.actions.remove-from-digitization-list"),
            icon: (
                <i className="pi pi-receipt p-overlay-badge mr-2">
                    <Badge
                        className="bg-transparent text-red-600 text-3xl"
                        value="-"
                    />
                </i>
            ),
            command: () =>
                onInitiateListItemsRemoval(
                    numSelected,
                    selectedQuery,
                    Number(digitizationListIdFacets[0])
                ),
        };
        items.push(removeDocumentsFromDigitizationListMenuItem);
    }

    return items;
};

export default DocumentsActionsMenuItems;
