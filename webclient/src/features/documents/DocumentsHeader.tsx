import { Button } from "primereact/button";
import { TieredMenu } from "primereact/tieredmenu";
import React, { useEffect, useRef, useState } from "react";
import DocumentsSearchBar from "./search-bar/DocumentsSearchBar";
import { SelectButton } from "primereact/selectbutton";
import { Toolbar } from "primereact/toolbar";
import { useTranslation } from "react-i18next";
import { useDocuments } from "../../contexts/documents/DocumentsContext";
import { OverlayPanel } from "primereact/overlaypanel";
import { TaskType } from "../../types/TaskType";
import { useAssignableCategories } from "../../contexts/categories/AssignableCategoriesContext";
import { ConfirmDialog } from "primereact/confirmdialog";
import { useDigitizationLists } from "../../contexts/extractions/DigitizationListsContext";
import { useDocumentsSearch } from "../../contexts/documents/search/DocumentsSearchContext";

interface DocumentsHeaderProps {
    onInsert: () => void;
    onCreate: () => void;
}

const DocumentsHeader: React.FC<DocumentsHeaderProps> = (props) => {
    const { t } = useTranslation();
    const {
        numFound,
        selectedDocuments,
        handleStartTask,
        handleSelectDocuments,
        selectAll,
        handleSelectAllDocuments,
        handleCancelSelection,
        handleDeleteDocuments,
        handleUpdateCategory,
        handleExportDocuments,
    } = useDocuments();
    const { categories } = useAssignableCategories();
    const { createDigitizationList } = useDigitizationLists();
    const { activeQuery } = useDocumentsSearch();

    const [advancedSearch, setAdvancedSearch] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const [displayOption, setDisplayOption] = useState("datatable");
    const displayOptions = [
        { name: "Option 1", icon: "pi pi-table", value: "datatable" },
        {
            name: "Option 2",
            icon: "pi pi-chart-bar",
            value: "graph",
            disabled: true,
        },
    ];

    const taskSelectorMenuRef = useRef(null);
    const taskSelectorItems = [
        {
            label: t("Export to file"),
            items: [
                {
                    label: t("Export to XSLX"),
                    command: () => handleExportDocuments(),
                },
            ],
        },
        {
            label: t("Change category"),
            items: categories.map((category) => ({
                label: category.getPath(),
                command: () => handleUpdateCategory(category.id, category.name),
            })),
        },
        {
            label: t("Create digitization list"),
            command: () =>
                createDigitizationList(
                    selectAll
                        ? activeQuery!
                        : { id_list: selectedDocuments.map((d) => d.id) }
                ),
        },
        {
            label: t("Predict volumes page counts"),
            command: () => handleStartTask(TaskType.PredictVolumePages),
        },
        {
            label: t("Sync from catalog"),
            command: () => handleStartTask(TaskType.SyncFromCatalog),
        },
        {
            label: t("Sync from digitization registry"),
            command: () =>
                handleStartTask(TaskType.SyncFromDigitizationRegistry),
        },
    ];
    const [confirmDeletionVisible, setConfirmDeletionVisible] = useState(false);

    const handleSetDisplayOption = (e) => {
        if (e.value !== null) {
            setDisplayOption(e.value);
        }
    };

    useEffect(() => {
        setHasSelection(selectedDocuments.length > 0);
    }, [selectedDocuments]);

    const toggleTaskSelectorMenu = (event) => {
        if (taskSelectorMenuRef.current) {
            (taskSelectorMenuRef.current as OverlayPanel).toggle(event);
        }
    };

    const displayOptionTemplate = (option) => {
        return (
            <div>
                <i className={option.icon}></i>
                {/* <span>{option.name}</span> */}
            </div>
        );
    };

    const startContent = (
        <React.Fragment>
            <Button
                label={t("insert_document")}
                icon="pi pi-plus"
                outlined
                onClick={props.onInsert}
            />
            <i className="pi pi-bars p-toolbar-separator m-1" />
            <SelectButton
                value={displayOption}
                onChange={handleSetDisplayOption}
                itemTemplate={displayOptionTemplate}
                options={displayOptions}
            />
        </React.Fragment>
    );

    const centerContent = (
        <React.Fragment>
            <DocumentsSearchBar />
        </React.Fragment>
    );

    const categorySelector = (
        <React.Fragment>
            <DocumentsSearchBar />
        </React.Fragment>
    );

    const endContent = (
        <React.Fragment>
            <div className="flex flex-column align-items-end">
                <div>
                    <TieredMenu
                        className="w-auto"
                        model={taskSelectorItems}
                        popup
                        ref={taskSelectorMenuRef}
                        id="popup_menu_left"
                    />
                    <Button
                        // icon="pi pi-th-large"
                        icon="pi pi-list"
                        className="p-button-rounded p-button-text"
                        severity={hasSelection ? "help" : "secondary"}
                        disabled={!hasSelection}
                        onClick={toggleTaskSelectorMenu}
                        aria-controls="popup_menu_left"
                        aria-haspopup
                        tooltip={t("Other options")}
                        tooltipOptions={{ position: "top", showDelay: 500 }}
                    />
                    <Button
                        icon="pi pi-trash"
                        className="p-button-rounded p-button-text"
                        severity={hasSelection ? "danger" : "secondary"}
                        disabled={!hasSelection}
                        onClick={() => setConfirmDeletionVisible(true)}
                        tooltip={t("Delete selected documents")}
                        tooltipOptions={{ position: "top", showDelay: 500 }}
                    />
                    <Button
                        icon="pi pi-times"
                        className="p-button-rounded p-button-text"
                        severity={hasSelection ? "info" : "secondary"}
                        disabled={!hasSelection}
                        onClick={handleCancelSelection}
                        tooltip={t("Cancel document selection")}
                        tooltipOptions={{ position: "top", showDelay: 500 }}
                    />
                    <ConfirmDialog
                        visible={confirmDeletionVisible}
                        onHide={() => setConfirmDeletionVisible(false)}
                        header={t("Delete documents")}
                        message={t(
                            "Are you sure you want to delete all selected documents?"
                        )}
                        icon="pi pi-exclamation-triangle"
                        acceptLabel={t("Delete")}
                        acceptClassName="p-button-danger"
                        rejectLabel={t("Cancel")}
                        accept={handleDeleteDocuments}
                    />
                </div>
                <span className="text-sm text-gray-700">
                    {t("Number of selected documents")}:{" "}
                    {selectAll ? numFound : selectedDocuments.length}
                </span>
            </div>
        </React.Fragment>
    );

    if (advancedSearch) {
        return (
            <Toolbar
                start={startContent}
                center={centerContent}
                end={endContent}
            />
        );
    }

    return (
        <Toolbar start={startContent} center={centerContent} end={endContent} />
    );
};

export default DocumentsHeader;
