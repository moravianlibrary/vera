import { Button } from "primereact/button";
import React, { useState } from "react";
import DocumentsSearchBar from "./search-bar/DocumentsSearchBar";
import { SelectButton } from "primereact/selectbutton";
import { Toolbar } from "primereact/toolbar";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "primereact/confirmdialog";
import DocumentsActionsMenu from "./ActionsMenu";
import { useDocumentsSelection } from "../../contexts/documents/DocumentsSelectionContext";
import { useDocumentsActions } from "../../contexts/documents/DocumentsActionsContext";
import { Badge } from "primereact/badge";

interface DocumentsHeaderProps {
    onInsert: () => void;
    onCreate: () => void;
}

const DocumentsHeader: React.FC<DocumentsHeaderProps> = (props) => {
    const { t } = useTranslation();
    const { numSelected, cancelSelection, isSelectAll, selectAllDocuments } =
        useDocumentsSelection();
    const { deleteDocuments } = useDocumentsActions();

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

    const [confirmDeletionVisible, setConfirmDeletionVisible] = useState(false);

    const handleSetDisplayOption = (e) => {
        if (e.value !== null) {
            setDisplayOption(e.value);
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
                <div className="flex align-items-center gap-2">
                    <DocumentsActionsMenu />
                    <Button
                        icon="pi pi-trash"
                        className="p-button-rounded p-button-text"
                        severity={numSelected > 0 ? "danger" : "secondary"}
                        disabled={numSelected === 0}
                        onClick={() => setConfirmDeletionVisible(true)}
                        tooltip={t("Delete selected documents")}
                        tooltipOptions={{ position: "top", showDelay: 500 }}
                    />
                    <Button
                        icon="pi pi-expand"
                        className="p-button-rounded p-button-text"
                        severity={!isSelectAll ? "info" : "secondary"}
                        disabled={isSelectAll}
                        onClick={() => selectAllDocuments(true)}
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
                        accept={deleteDocuments}
                    />
                </div>
                <Badge
                    className="surface-50 text-gray-600"
                    value={`${t(
                        "Number of selected documents"
                    )}: ${numSelected}`}
                />
            </div>
        </React.Fragment>
    );

    return (
        <Toolbar start={startContent} center={centerContent} end={endContent} />
    );
};

export default DocumentsHeader;
